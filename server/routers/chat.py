"""
chat.py — Chat & Vision Router

Endpoints:
  POST /chat         — Text chat with web search augmentation
  POST /chat/vision  — Multimodal image + text analysis

Both share the same spatial context logic and use the single unified
LLM model (google/gemma-4-26b-a4b-it:free).

Web Search Flow (Task 3):
  1. LLM classifier decides if the query needs live data (temperature=0)
  2. If yes: Tavily search → results injected into prompt as WEB_SEARCH_RESULTS
  3. LLM generates a cited, grounded answer

Vision Flow (Task 4):
  1. Base64 image + text message → sent as multimodal content array
  2. Vision LLM identifies subject, explains significance, translates Korean text
  3. Returns TTS-friendly plain text reply
"""

import re
import uuid
import math
import asyncio
import httpx
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException

from server.config import (
    OPENROUTER_API_KEY,
    NVIDIA_API_KEY,
    LLM_MODEL_ID,
    VISION_MODEL_ID,
    OPENROUTER_BASE_URL,
    NVIDIA_BASE_URL,
    WAYPOINTS,
)
from server.models import (
    ChatRequest,
    ChatResponse,
    VisionChatRequest,
    VisionChatResponse,
)
from server.database import (
    create_session,
    get_session,
    get_chat_history,
    save_chat_message,
    get_activity_logs,
)
from server.services.web_search import (
    needs_web_search,
    classify_intent,
    search_with_fallback,
    format_search_results_for_prompt,
)
from server.services.rag import search_rag
from server.services.map_snapshot import get_map_snapshot
from server.services.geocoding import geocode_search, format_geocoding_for_prompt

router = APIRouter(prefix="/chat", tags=["Chat"])


# ---------------------------------------------------------------------------
# Shared system prompt
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """\
You are SeoulWalk, a voice-first AI tour guide for Gyeongbokgung Palace, Seoul.
You assist foreign tourists walking through the palace grounds.

### 1. TEMPORAL & ENVIRONMENTAL CONTEXT
{temporal_context}

### 2. Core Persona
Calm, observant local expert. Prioritize physical safety and spatial orientation.

### 3. Zero-Guess Spatial Policy
Use egocentric language (ahead, to your left, behind you) ONLY when the target
is explicitly in CURRENT CONTEXT below. Otherwise: "I don't have its exact
direction from here, but I can open Naver Map for you."

### 4. Trust Hierarchy (highest to lowest)
  1. WEB_SEARCH_RESULTS (if present) — most current, always cite domain
  2. CURRENT CONTEXT (waypoint knowledge)
  3. Your training data (last resort, mark as "Based on general knowledge,")

### 5. Sourcing Rule
When using WEB_SEARCH_RESULTS, cite the source domain in parentheses.
Example: "Admission is 3,000 KRW (royal.khs.go.kr)."
If sources conflict, use the most recent web result.

### 6. Spoken UI
- 2-4 short, clear sentences. TTS output — no markdown, no bullet points.
- If user is moving, keep it brief. Safety comes first.

### 7. Scope
Expert on Gyeongbokgung, nearby Seoul, Korean etiquette. Redirect off-topic queries.
"""

_VISION_SYSTEM_PROMPT = """\
You are SeoulWalk, an AI tour guide for Gyeongbokgung Palace. The user has taken
a photo of something they see while walking through the palace grounds.

### 1. TEMPORAL & ENVIRONMENTAL CONTEXT
{temporal_context}

Your task:
1. IDENTIFY what is in the photo (building, gate, decoration, sign, artifact, etc.)
2. State its Korean name (if applicable) and English translation or common name.
3. Explain its historical or cultural significance in 2-3 sentences.
4. If there is Korean text (한글) visible in the photo, translate it to English.
5. If you cannot confidently identify the subject, say so honestly — never guess.

CURRENT CONTEXT:
{gps_context}

Rules — your output will be read aloud via Text-to-Speech:
- Plain text only. No markdown, no bullet points, no asterisks.
- 2-4 sentences total. Keep it brief and conversational.
- Do not describe image quality or camera angles — focus on the subject.
"""


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_env_cache = {"data": "", "timestamp": 0}

async def _get_live_environment() -> str:
    """Fetch current time in Seoul and weather from Open-Meteo."""
    global _env_cache
    now = time.time()
    if now - _env_cache["timestamp"] < 900:  # 15 minute cache
        return _env_cache["data"]

    # Current Time in Seoul
    seoul_time = datetime.now(ZoneInfo("Asia/Seoul"))
    time_str = seoul_time.strftime("%A, %B %d, %Y, %H:%M KST")

    # Fetch Weather (Palace coords: 37.5796, 126.9770)
    weather_desc = "Unknown"
    temp = "?"
    uv = "?"
    aqi = "?"
    
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            w_resp = await client.get(
                "https://api.open-meteo.com/v1/forecast?latitude=37.5796&longitude=126.9770&current=temperature_2m,weather_code&daily=uv_index_max&timezone=Asia%2FSeoul"
            )
            if w_resp.status_code == 200:
                w_data = w_resp.json()
                temp = w_data.get("current", {}).get("temperature_2m", "?")
                code = w_data.get("current", {}).get("weather_code", 0)
                if code == 0: weather_desc = "Clear"
                elif code in [1, 2, 3]: weather_desc = "Partly Cloudy"
                elif code in [61, 63, 65, 80, 81, 82]: weather_desc = "Rain"
                elif code in [71, 73, 75, 85, 86]: weather_desc = "Snow"
                else: weather_desc = "Cloudy/Overcast"
                
                daily = w_data.get("daily", {})
                if "uv_index_max" in daily and daily["uv_index_max"]:
                    uv = daily["uv_index_max"][0]

            a_resp = await client.get(
                "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.5796&longitude=126.9770&current=us_aqi&timezone=Asia%2FSeoul"
            )
            if a_resp.status_code == 200:
                a_data = a_resp.json()
                aqi = a_data.get("current", {}).get("us_aqi", "?")
    except Exception:
        pass # Silently fail and use fallbacks

    context = f"- Current Time: {time_str}\n- Weather: {temp}°C, {weather_desc}\n- UV Index: {uv}\n- Air Quality (AQI): {aqi}"
    _env_cache["data"] = context
    _env_cache["timestamp"] = now
    
    return context


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371e3
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _find_waypoint(waypoint_id: str | None, lat: float | None, lng: float | None) -> dict | None:
    if waypoint_id:
        for wp in WAYPOINTS:
            if wp["id"] == waypoint_id:
                return wp

    if lat is not None and lng is not None:
        for wp in WAYPOINTS:
            dist = _haversine(lat, lng, wp["coordinates"]["latitude"], wp["coordinates"]["longitude"])
            if dist <= wp["radius"]:
                return wp

    return None


def _build_context(wp: dict | None) -> str:
    if not wp:
        return "The user is at Gyeongbokgung Palace grounds, not near any specific known waypoint."
    ctx = f"The user is currently at {wp['name']}.\nKnowledge: {wp['knowledgeSummary']}"
    if wp.get("surroundings"):
        ctx += f"\nSurrounding Buildings: {wp['surroundings']}"
    if wp.get("facilities"):
        ctx += f"\nNearby Facilities: {wp['facilities']}"
    return ctx


async def _build_activity_context(session_id: str) -> str:
    """Build a brief activity summary for the system prompt."""
    logs = await get_activity_logs(session_id, limit=20)
    if not logs:
        return ""

    wp_names = {wp["id"]: wp["name"] for wp in WAYPOINTS}
    visited = []
    for log in logs:
        wp_id = log.get("matched_waypoint_id")
        if wp_id and (not visited or visited[-1]["id"] != wp_id):
            visited.append({
                "id": wp_id,
                "name": wp_names.get(wp_id, wp_id),
                "time": log["timestamp"]
            })

    if not visited:
        return ""

    lines = [f"- {v['name']} (at {v['time']})" for v in visited]
    current = visited[-1]["name"]
    return (
        f"\n\n### ACTIVITY LOG (places the user has already visited today)\n"
        + "\n".join(lines)
        + f"\nThe user is currently near: {current}."
        + "\nDo not re-suggest places they have already visited unless they ask."
    )


def _strip_thinking(text: str | None) -> str:
    """Remove <think>...</think> reasoning traces from model output (for TTS safety)."""
    if not text:
        return ""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


async def _call_llm(
    messages: list[dict],
    model: str,
    temperature: float = 0.7,
    provider: str = "openrouter",
) -> str:
    """
    Call the LLM via the selected provider.
    - provider='openrouter' → OpenRouter (default)
    - provider='nvidia'     → NVIDIA NIM
    Reasoning traces (<think>...</think>) are always stripped before returning.
    """
    if provider == "nvidia":
        if not NVIDIA_API_KEY:
            raise HTTPException(status_code=500, detail="Missing NVIDIA_API_KEY")
        url = NVIDIA_BASE_URL
        api_key = NVIDIA_API_KEY
        is_reasoning = "reasoning" in model
        extra: dict = {}
        if is_reasoning:
            extra["extra_body"] = {
                "chat_template_kwargs": {"enable_thinking": True},
                "reasoning_budget": 8192,
            }
    else:
        if not OPENROUTER_API_KEY:
            raise HTTPException(status_code=500, detail="Missing OpenRouter API key")
        url = OPENROUTER_BASE_URL
        api_key = OPENROUTER_API_KEY
        extra = {}

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        **extra,
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail=f"Request to {provider} LLM API timed out.",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with {provider} LLM API: {exc}",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"{provider} API returned {resp.status_code}: {resp.text[:300]}",
        )

    raw = resp.json().get("choices", [{}])[0].get("message", {}).get("content") or ""
    return _strip_thinking(raw)


# ---------------------------------------------------------------------------
# POST /chat — Text chat with optional web search augmentation
# ---------------------------------------------------------------------------

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Process a user text message.
    Automatically determines whether live web search is needed,
    fetches results if so, and injects them into the LLM context.
    Supports model/provider override from the debug dashboard.
    """
    provider = req.provider or "nvidia"
    model = req.model_override or LLM_MODEL_ID
    api_ok = OPENROUTER_API_KEY if provider == "openrouter" else NVIDIA_API_KEY
    if not api_ok:
        raise HTTPException(status_code=500, detail=f"Missing API key for provider '{provider}'")

    # Session management
    session_id = req.session_id or str(uuid.uuid4())
    if not await get_session(session_id):
        await create_session(session_id, location="Gwanghwamun")

    # Spatial context
    waypoint = _find_waypoint(req.waypoint_id, req.latitude, req.longitude)
    gps_context = _build_context(waypoint)

    # --- Conversation History ---
    history = await get_chat_history(session_id, limit=6)
    last_ai_message = history[-1]["content"] if history and history[-1]["role"] == "assistant" else ""

    # --- 4-Way Intent Classification ---
    search_block = ""
    search_used = False
    geocode_block = ""

    intent = await classify_intent(
        user_message=req.message,
        last_ai_message=last_ai_message,
        provider=provider,
        model=model,
    )
    print(f"🧠 Intent classification: {intent}")

    if intent == "WEB_SEARCH":
        results = await search_with_fallback(req.message)
        if results:
            search_block = "\n\n" + format_search_results_for_prompt(results)
            search_used = True
    elif intent == "MAP_GEOCODE":
        # Geocode search — resolve specific place names to coordinates
        lat = req.latitude
        lng = req.longitude
        if (lat is None or lng is None) and waypoint:
            lat = waypoint["coordinates"]["latitude"]
            lng = waypoint["coordinates"]["longitude"]
        geo_results = await geocode_search(
            query=req.message,
            center_lng=lng,
            center_lat=lat,
        )
        if geo_results:
            geocode_block = "\n\n" + format_geocoding_for_prompt(geo_results, req.message)
    elif intent == "MAP_STATIC":
        # MAP_STATIC — no extra retrieval needed; the map snapshot image
        # will be attached to the user message payload below.
        pass
    else:
        # RAG — default fallback for palace/history knowledge
        rag_context = await asyncio.to_thread(search_rag, req.message)
        if rag_context:
            search_block = f"\n\n{rag_context}"

    # Temporal context
    temporal_context = await _get_live_environment()

    # Build activity context (visited waypoints)
    activity_context = await _build_activity_context(session_id)

    # Build system prompt — append context + activity + search/geocode results
    full_system = (
        _SYSTEM_PROMPT.format(temporal_context=temporal_context)
        + f"\n\nCURRENT CONTEXT:\n{gps_context}"
        + activity_context
        + f"{search_block}"
        + f"{geocode_block}"
    )

    # Resolve coordinates for map snapshot
    lat = req.latitude
    lng = req.longitude
    if (lat is None or lng is None) and waypoint:
        lat = waypoint["coordinates"]["latitude"]
        lng = waypoint["coordinates"]["longitude"]

    # Fetch map snapshot (for MAP_STATIC and MAP_GEOCODE intents, or whenever coords exist)
    map_snapshot_b64 = None
    if lat is not None and lng is not None:
        map_snapshot_b64 = await get_map_snapshot(lat, lng)

    # Build user message content (multimodal if map snapshot exists)
    user_content = req.message
    if map_snapshot_b64:
        user_content = [
            {"type": "text", "text": req.message},
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{map_snapshot_b64}"},
            },
        ]

    messages = [{"role": "system", "content": full_system}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_content})

    reply = await _call_llm(
        messages=messages,
        model=model,
        temperature=0.7,
        provider=provider,
    )

    # Save to history
    await save_chat_message(session_id, "user", req.message)
    await save_chat_message(session_id, "assistant", reply)

    # Detect Naver Map action
    action = "OPEN_NAVER_MAP" if "naver map" in reply.lower() else None

    debug_trace = {
        "intent": intent,
        "should_search": intent == "WEB_SEARCH",
        "gps_context": gps_context,
        "activity_context": activity_context,
        "search_block": (search_block + geocode_block).strip(),
        "full_prompt": full_system,
        "map_snapshot_included": map_snapshot_b64 is not None,
        "messages_sent": messages,
    }

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        waypoint_id=waypoint["id"] if waypoint else None,
        action=action,
        web_search_used=search_used,
        debug_trace=debug_trace,
    )


# ---------------------------------------------------------------------------
# POST /chat/vision — Multimodal image + text
# ---------------------------------------------------------------------------

@router.post("/vision", response_model=VisionChatResponse)
async def chat_vision(req: VisionChatRequest):
    """
    Process a user photo + optional text question.
    Uses the vision-capable Gemma model to identify and explain what is in the image.
    Returns a TTS-friendly plain text reply.
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OpenRouter API key")

    # Session management
    session_id = req.session_id or str(uuid.uuid4())
    if not await get_session(session_id):
        await create_session(session_id, location="Gwanghwamun")

    # Spatial context
    waypoint = _find_waypoint(req.waypoint_id, req.latitude, req.longitude)
    gps_context = _build_context(waypoint)

    # Build multimodal message — OpenRouter uses the OpenAI content array format
    data_url = f"data:{req.image_mime_type};base64,{req.image_base64}"

    user_content = [
        {"type": "text", "text": req.message},
        {"type": "image_url", "image_url": {"url": data_url}},
    ]

    temporal_context = await _get_live_environment()
    vision_system = _VISION_SYSTEM_PROMPT.format(
        temporal_context=temporal_context, 
        gps_context=gps_context
    )

    reply = await _call_llm(
        messages=[
            {"role": "system", "content": vision_system},
            {"role": "user", "content": user_content},
        ],
        model=VISION_MODEL_ID,
        temperature=0.4,
        provider="openrouter",  # Vision always uses OpenRouter (NIM vision uses different endpoint)
    )

    # Try to extract the identified subject from the first sentence of the reply
    identified = None
    if reply:
        first_sentence = reply.split(".")[0].strip()
        if len(first_sentence) < 80:  # Plausibly a name, not a paragraph
            identified = first_sentence

    # Save text conversation to history
    await save_chat_message(session_id, "user", f"[Photo attached] {req.message}")
    await save_chat_message(session_id, "assistant", reply)

    debug_trace = {
        "gps_context": gps_context,
        "full_prompt": vision_system,
    }

    return VisionChatResponse(
        reply=reply,
        session_id=session_id,
        waypoint_id=waypoint["id"] if waypoint else None,
        identified_subject=identified,
        debug_trace=debug_trace,
    )
