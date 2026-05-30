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
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

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
    get_itinerary_items,
    save_chat_message,
    get_activity_logs,
    save_trace_event,
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
from server.services.langsmith_tracing import sanitize_trace_payload, traceable
from server.services.trace_artifacts import save_base64_image_artifact
from server.routers.handoff import build_naver_search_urls, build_naver_urls

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

### 8. Itinerary Context Rule
Use ITINERARY CONTEXT when the user asks about next steps, schedule, route
progress, remaining stops, or plans.

For ambiguous questions like "Where should we go now?", "What's next?", or
"What should we do?", provide both:
- the next planned itinerary stop
- a nearby/current-location option from CURRENT CONTEXT, if available

Do not tell the user they are off-course, behind schedule, or in the wrong
place unless they explicitly ask whether they are off-route/on-track.

Example: "According to our schedule, we should head to Sajeongjeon next. If you
meant what's interesting right around here, Geunjeongjeon's courtyard and
Gyeonghoeru Pavilion are also worth looking at from this spot."

### 9. Directions & Map Handoff Rule
For ambiguous direction questions like "How do I get to X?", "Where is X?", or
"Can you show me X?", provide both:
- a brief spatial/location answer in words, using CURRENT CONTEXT or GEOCODING
  SEARCH RESULTS when available
- a concise offer to open Naver Map for turn-by-turn navigation

Do not require the user to say "open Naver" explicitly before giving this dual
answer. If exact direction is not available, say so briefly and rely on Naver
Map for navigation.

For amenity questions such as bathrooms, restrooms, toilets, pharmacies, cafes,
or convenience stores, do not claim exact live availability unless it appears in
CURRENT CONTEXT. Give the local/contextual clue if available, then offer Naver
Map search. Example: "There may be restrooms near the Donggung entrance
according to palace context. I can also search Naver for bathrooms nearby."
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


async def _build_itinerary_context(session_id: str) -> str:
    """Build a compact saved-itinerary summary for route-aware chat."""
    items = await get_itinerary_items(session_id)
    if not items:
        return ""

    lines = []
    for item in items:
        duration = item.get("duration_minutes") or 0
        cost = item.get("estimated_cost_krw") or 0
        details = []
        if duration:
            details.append(f"{duration} min")
        details.append("free" if cost <= 0 else f"{cost:,} KRW")
        if item.get("latitude") is not None and item.get("longitude") is not None:
            details.append(f"coords {item['latitude']:.6f}, {item['longitude']:.6f}")

        lines.append(
            f"- {item['order']}. {item['place']} at {item['time']} "
            f"({', '.join(details)}): {item.get('activity') or 'Visit this stop'}"
        )

    return (
        "\n\n### ITINERARY CONTEXT\n"
        "Saved route for this session, in planned order:\n"
        + "\n".join(lines)
        + "\nUse this route for schedule, next-step, remaining-stop, and plan questions."
        + "\nCombine it with CURRENT CONTEXT for ambiguous next-step questions."
    )


async def _trace_chat_event(session_id: str, event_type: str, payload: dict | None = None) -> None:
    """Best-effort behavior trace logging; never block the chat flow."""
    try:
        await save_trace_event(
            session_id=session_id,
            event_type=event_type,
            event_payload=payload or {},
            source="backend",
        )
    except Exception as exc:
        print(f"⚠️ Failed to save trace event {event_type}: {exc}")


@traceable(name="Resolve Waypoint Context", run_type="tool")
async def _resolve_waypoint_context(
    waypoint_id: str | None,
    latitude: float | None,
    longitude: float | None,
) -> tuple[dict | None, str]:
    waypoint = _find_waypoint(waypoint_id, latitude, longitude)
    return waypoint, _build_context(waypoint)


@traceable(name="Build Activity Context", run_type="tool")
async def _get_activity_context_for_trace(session_id: str) -> str:
    return await _build_activity_context(session_id)


@traceable(name="Build Itinerary Context", run_type="tool")
async def _get_itinerary_context_for_trace(session_id: str) -> str:
    return await _build_itinerary_context(session_id)


def _strip_thinking(text: str | None) -> str:
    """Remove <think>...</think> reasoning traces from model output (for TTS safety)."""
    if not text:
        return ""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


@traceable(
    name="Provider Chat Completion",
    run_type="llm",
    process_inputs=sanitize_trace_payload,
    process_outputs=sanitize_trace_payload,
)
async def _call_llm(
    messages: list[dict],
    model: str,
    temperature: float = 0.7,
    provider: str = "nvidia",
) -> str:
    """
    Call the LLM via the selected provider.
    - provider='nvidia'     → NVIDIA NIM (default)
    - provider='openrouter' → OpenRouter, reserved for vision
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


async def _stream_llm(
    messages: list[dict],
    model: str,
    temperature: float = 0.7,
):
    """Stream NVIDIA NIM chat completion deltas."""
    if not NVIDIA_API_KEY:
        raise HTTPException(status_code=500, detail="Missing NVIDIA_API_KEY")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                NVIDIA_BASE_URL,
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    text = await resp.aread()
                    raise HTTPException(
                        status_code=502,
                        detail=f"nvidia API returned {resp.status_code}: {text.decode('utf-8', errors='replace')[:300]}",
                    )

                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    if line == "[DONE]":
                        break
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    delta = (
                        chunk.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content")
                    )
                    if delta:
                        yield delta
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to nvidia LLM API timed out.")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with nvidia LLM API: {exc}")


async def _emit_prepare_status(status_callback, label: str):
    if status_callback:
        await status_callback(label)


def _build_naver_action_payload_from_geocode(query: str, results: list[dict]) -> dict | None:
    """Build a deterministic Naver handoff target from the best geocode result."""
    if not results:
        return None

    best = results[0]
    lat = best.get("latitude")
    lng = best.get("longitude")
    if lat is None or lng is None:
        return None

    place_name = (
        best.get("building_name")
        or best.get("road_address")
        or best.get("english_address")
        or query
    )
    urls = build_naver_urls(place_name, lat, lng)
    return {
        "place_name": place_name,
        "latitude": lat,
        "longitude": lng,
        "naver_app_url": urls["naver_app_url"],
        "naver_web_url": urls["naver_web_url"],
    }


_AMENITY_SEARCH_TERMS = [
    (
        ("bathroom", "bathrooms", "restroom", "restrooms", "toilet", "toilets", "washroom", "wc"),
        "bathroom",
        "화장실",
    ),
    (
        ("pharmacy", "pharmacies", "drugstore", "medicine"),
        "pharmacy",
        "약국",
    ),
    (
        ("convenience store", "convenience stores", "7-eleven", "cu store", "gs25"),
        "convenience store",
        "편의점",
    ),
    (
        ("cafe", "cafes", "coffee", "coffee shop"),
        "cafe",
        "카페",
    ),
]


def _detect_amenity_search(message: str) -> dict | None:
    """Return display and Naver search terms for amenity requests."""
    normalized = f" {message.lower()} "
    for triggers, query, naver_query in _AMENITY_SEARCH_TERMS:
        if any(f" {trigger} " in normalized or trigger in normalized for trigger in triggers):
            return {
                "query": query,
                "naver_query": naver_query,
            }
    return None


def _build_naver_action_payload_from_search(
    query: str,
    naver_query: str,
    latitude: float | None,
    longitude: float | None,
) -> dict:
    urls = build_naver_search_urls(naver_query, latitude=latitude, longitude=longitude)
    return {
        "place_name": query,
        "query": query,
        "naver_query": naver_query,
        "latitude": latitude,
        "longitude": longitude,
        "naver_app_url": urls["naver_app_url"],
        "naver_web_url": urls["naver_web_url"],
        "handoff_type": "search",
    }


async def _prepare_chat_completion(req: ChatRequest, status_callback=None) -> dict:
    """Build all context needed for either normal or streaming chat completion."""
    provider = "nvidia"
    model = req.model_override or LLM_MODEL_ID
    if not NVIDIA_API_KEY:
        raise HTTPException(status_code=500, detail="Missing NVIDIA_API_KEY")

    session_id = req.session_id or str(uuid.uuid4())
    if not await get_session(session_id):
        await create_session(session_id, location="Gwanghwamun")
    await _trace_chat_event(
        session_id,
        "chat_request_received",
        {
            "message": req.message,
            "message_length": len(req.message),
            "waypoint_id": req.waypoint_id,
            "has_coordinates": req.latitude is not None and req.longitude is not None,
        },
    )

    await _emit_prepare_status(status_callback, "Resolving location")
    waypoint, gps_context = await _resolve_waypoint_context(
        req.waypoint_id,
        req.latitude,
        req.longitude,
    )
    await _trace_chat_event(
        session_id,
        "chat_waypoint_context_resolved",
        {
            "requested_waypoint_id": req.waypoint_id,
            "resolved_waypoint_id": waypoint["id"] if waypoint else None,
            "resolved_waypoint_name": waypoint["name"] if waypoint else None,
            "resolution": "explicit_waypoint_or_geofence" if waypoint else "none",
        },
    )

    history = await get_chat_history(session_id, limit=6)
    last_ai_message = history[-1]["content"] if history and history[-1]["role"] == "assistant" else ""

    search_block = ""
    search_used = False
    geocode_block = ""
    naver_action_payload = None
    amenity_search = _detect_amenity_search(req.message)

    await _emit_prepare_status(status_callback, "Understanding request")
    intent = await classify_intent(
        user_message=req.message,
        last_ai_message=last_ai_message,
        provider=provider,
        model=model,
    )
    print(f"🧠 Intent classification: {intent}")
    await _trace_chat_event(
        session_id,
        "chat_intent_classified",
        {
            "intent": intent,
            "model": model,
            "has_last_assistant_message": bool(last_ai_message),
            "amenity_search_query": amenity_search["query"] if amenity_search else None,
            "amenity_naver_query": amenity_search["naver_query"] if amenity_search else None,
        },
    )

    if intent == "WEB_SEARCH":
        await _emit_prepare_status(status_callback, "Searching online")
        await _trace_chat_event(session_id, "chat_web_search_started", {"query": req.message})
        results = await search_with_fallback(req.message)
        await _trace_chat_event(session_id, "chat_web_search_completed", {"result_count": len(results or [])})
        if results:
            search_block = "\n\n" + format_search_results_for_prompt(results)
            search_used = True
    elif intent == "MAP_GEOCODE" and not amenity_search:
        await _emit_prepare_status(status_callback, "Searching Naver Maps")
        lat = req.latitude
        lng = req.longitude
        if (lat is None or lng is None) and waypoint:
            lat = waypoint["coordinates"]["latitude"]
            lng = waypoint["coordinates"]["longitude"]
        await _trace_chat_event(
            session_id,
            "chat_geocode_started",
            {"query": req.message, "center_lat": lat, "center_lng": lng},
        )
        geo_results = await geocode_search(query=req.message, center_lng=lng, center_lat=lat)
        await _trace_chat_event(session_id, "chat_geocode_completed", {"result_count": len(geo_results or [])})
        if geo_results:
            geocode_block = "\n\n" + format_geocoding_for_prompt(geo_results, req.message)
            naver_action_payload = _build_naver_action_payload_from_geocode(req.message, geo_results)
            await _trace_chat_event(
                session_id,
                "chat_naver_handoff_target_resolved",
                {
                    "place_name": naver_action_payload["place_name"] if naver_action_payload else None,
                    "latitude": naver_action_payload["latitude"] if naver_action_payload else None,
                    "longitude": naver_action_payload["longitude"] if naver_action_payload else None,
                    "source": "naver_geocode",
                },
            )
    elif intent == "MAP_STATIC":
        await _trace_chat_event(
            session_id,
            "chat_map_static_context_selected",
            {"waypoint_id": waypoint["id"] if waypoint else None},
        )
    else:
        if amenity_search:
            await _emit_prepare_status(status_callback, "Preparing Naver search")
        await _emit_prepare_status(status_callback, "Searching palace knowledge")
        await _trace_chat_event(session_id, "chat_rag_search_started", {"query": req.message})
        rag_context = await asyncio.to_thread(search_rag, req.message)
        await _trace_chat_event(session_id, "chat_rag_search_completed", {"has_context": bool(rag_context)})
        if rag_context:
            search_block = f"\n\n{rag_context}"

    await _emit_prepare_status(status_callback, "Checking live conditions")
    temporal_context = await _get_live_environment()
    activity_context = await _get_activity_context_for_trace(session_id)
    itinerary_context = await _get_itinerary_context_for_trace(session_id)
    await _trace_chat_event(session_id, "chat_itinerary_context_loaded", {"included": bool(itinerary_context)})

    full_system = (
        _SYSTEM_PROMPT.format(temporal_context=temporal_context)
        + f"\n\nCURRENT CONTEXT:\n{gps_context}"
        + activity_context
        + itinerary_context
        + f"{search_block}"
        + f"{geocode_block}"
    )

    lat = req.latitude
    lng = req.longitude
    if (lat is None or lng is None) and waypoint:
        lat = waypoint["coordinates"]["latitude"]
        lng = waypoint["coordinates"]["longitude"]

    if amenity_search and not naver_action_payload:
        naver_action_payload = _build_naver_action_payload_from_search(
            amenity_search["query"],
            amenity_search["naver_query"],
            latitude=lat,
            longitude=lng,
        )
        await _trace_chat_event(
            session_id,
            "chat_naver_handoff_target_resolved",
            {
                "place_name": naver_action_payload["place_name"],
                "query": naver_action_payload["query"],
                "naver_query": naver_action_payload["naver_query"],
                "latitude": naver_action_payload["latitude"],
                "longitude": naver_action_payload["longitude"],
                "source": "amenity_search",
            },
        )

    map_snapshot_b64 = None
    map_snapshot_artifact = None
    if lat is not None and lng is not None:
        await _emit_prepare_status(status_callback, "Processing map context")
        await _trace_chat_event(session_id, "chat_map_snapshot_started", {"latitude": lat, "longitude": lng})
        map_snapshot_b64 = await get_map_snapshot(lat, lng)
        if map_snapshot_b64:
            map_snapshot_artifact = save_base64_image_artifact(
                image_base64=map_snapshot_b64,
                session_id=session_id,
                label="map-snapshot",
                mime_type="image/png",
                metadata={
                    "source": "naver_static_map",
                    "latitude": lat,
                    "longitude": lng,
                    "waypoint_id": waypoint["id"] if waypoint else None,
                },
            )
        await _trace_chat_event(
            session_id,
            "chat_map_snapshot_completed",
            {"included": map_snapshot_b64 is not None, "artifact": map_snapshot_artifact},
        )

    user_content = req.message
    if map_snapshot_b64:
        user_content = [
            {"type": "text", "text": req.message},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{map_snapshot_b64}"}},
        ]

    messages = [{"role": "system", "content": full_system}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_content})

    return {
        "provider": provider,
        "model": model,
        "session_id": session_id,
        "waypoint": waypoint,
        "gps_context": gps_context,
        "activity_context": activity_context,
        "itinerary_context": itinerary_context,
        "search_block": search_block,
        "geocode_block": geocode_block,
        "search_used": search_used,
        "intent": intent,
        "full_system": full_system,
        "map_snapshot_included": map_snapshot_b64 is not None,
        "map_snapshot_artifact": map_snapshot_artifact,
        "naver_action_payload": naver_action_payload,
        "messages": messages,
    }


# ---------------------------------------------------------------------------
# POST /chat — Text chat with optional web search augmentation
# ---------------------------------------------------------------------------

@router.post("", response_model=ChatResponse)
@traceable(
    name="SeoulWalk Text Chat",
    run_type="chain",
    process_inputs=sanitize_trace_payload,
    process_outputs=sanitize_trace_payload,
)
async def chat(req: ChatRequest):
    """
    Process a user text message.
    Automatically determines whether live web search is needed,
    fetches results if so, and injects them into the LLM context.
    Text chat uses NVIDIA NIM. OpenRouter is reserved for vision.
    """
    prepared = await _prepare_chat_completion(req)
    session_id = prepared["session_id"]
    waypoint = prepared["waypoint"]
    model = prepared["model"]
    provider = prepared["provider"]
    intent = prepared["intent"]
    messages = prepared["messages"]
    started_at = time.perf_counter()
    await _trace_chat_event(
        session_id,
        "chat_llm_response_started",
        {
            "provider": provider,
            "model": model,
            "intent": intent,
            "map_snapshot_included": prepared["map_snapshot_included"],
        },
    )
    try:
        reply = await _call_llm(
            messages=messages,
            model=model,
            temperature=0.7,
            provider=provider,
        )
    except Exception as exc:
        await _trace_chat_event(
            session_id,
            "chat_llm_response_failed",
            {
                "provider": provider,
                "model": model,
                "intent": intent,
                "error_type": type(exc).__name__,
                "duration_ms": round((time.perf_counter() - started_at) * 1000),
            },
        )
        raise

    # Save to history
    await save_chat_message(session_id, "user", req.message)
    await save_chat_message(session_id, "assistant", reply)

    naver_action_payload = prepared["naver_action_payload"]
    action = "OPEN_NAVER_MAP" if naver_action_payload or "naver map" in reply.lower() else None
    await _trace_chat_event(
        session_id,
        "chat_llm_response_completed",
        {
            "provider": provider,
            "model": model,
            "intent": intent,
            "duration_ms": round((time.perf_counter() - started_at) * 1000),
            "reply_length": len(reply),
            "action": action,
            "web_search_used": prepared["search_used"],
        },
    )

    debug_trace = {
        "intent": intent,
        "should_search": intent == "WEB_SEARCH",
        "gps_context": prepared["gps_context"],
        "activity_context": prepared["activity_context"],
        "itinerary_context": prepared["itinerary_context"],
        "search_block": (prepared["search_block"] + prepared["geocode_block"]).strip(),
        "full_prompt": prepared["full_system"],
        "map_snapshot_included": prepared["map_snapshot_included"],
        "map_snapshot_artifact": prepared["map_snapshot_artifact"],
        "messages_sent": sanitize_trace_payload(messages),
    }

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        waypoint_id=waypoint["id"] if waypoint else None,
        action=action,
        action_payload=naver_action_payload,
        web_search_used=prepared["search_used"],
        debug_trace=debug_trace,
    )


def _stream_event(event_type: str, **payload) -> str:
    return json.dumps({"type": event_type, **payload}, ensure_ascii=False) + "\n"


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """Stream text chat response as newline-delimited JSON events."""

    async def event_generator():
        prepared = None
        started_at = time.perf_counter()
        try:
            yield _stream_event("status", label="Preparing context")
            status_queue: asyncio.Queue[str] = asyncio.Queue()

            async def enqueue_status(label: str):
                await status_queue.put(label)

            prepare_task = asyncio.create_task(
                _prepare_chat_completion(req, status_callback=enqueue_status)
            )
            while True:
                status_task = asyncio.create_task(status_queue.get())
                done, pending = await asyncio.wait(
                    {prepare_task, status_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if status_task in done:
                    yield _stream_event("status", label=status_task.result())
                else:
                    status_task.cancel()

                if prepare_task in done:
                    for pending_task in pending:
                        pending_task.cancel()
                    prepared = await prepare_task
                    break

            session_id = prepared["session_id"]
            waypoint = prepared["waypoint"]
            model = prepared["model"]
            intent = prepared["intent"]
            messages = prepared["messages"]

            yield _stream_event(
                "meta",
                session_id=session_id,
                waypoint_id=waypoint["id"] if waypoint else None,
                intent=intent,
                web_search_used=prepared["search_used"],
            )
            yield _stream_event("status", label="Generating answer")

            await _trace_chat_event(
                session_id,
                "chat_llm_stream_started",
                {
                    "provider": "nvidia",
                    "model": model,
                    "intent": intent,
                    "map_snapshot_included": prepared["map_snapshot_included"],
                },
            )

            chunks: list[str] = []
            async for delta in _stream_llm(messages=messages, model=model, temperature=0.7):
                chunks.append(delta)
                yield _stream_event("delta", text=delta)

            reply = _strip_thinking("".join(chunks))
            await save_chat_message(session_id, "user", req.message)
            await save_chat_message(session_id, "assistant", reply)
            naver_action_payload = prepared["naver_action_payload"]
            action = "OPEN_NAVER_MAP" if naver_action_payload or "naver map" in reply.lower() else None
            await _trace_chat_event(
                session_id,
                "chat_llm_stream_completed",
                {
                    "provider": "nvidia",
                    "model": model,
                    "intent": intent,
                    "duration_ms": round((time.perf_counter() - started_at) * 1000),
                    "reply_length": len(reply),
                    "action": action,
                    "web_search_used": prepared["search_used"],
                },
            )
            yield _stream_event(
                "done",
                reply=reply,
                session_id=session_id,
                waypoint_id=waypoint["id"] if waypoint else None,
                action=action,
                action_payload=naver_action_payload,
                web_search_used=prepared["search_used"],
            )
        except Exception as exc:
            session_id = prepared["session_id"] if prepared else (req.session_id or "unknown")
            await _trace_chat_event(
                session_id,
                "chat_llm_stream_failed",
                {
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                    "duration_ms": round((time.perf_counter() - started_at) * 1000),
                },
            )
            yield _stream_event("error", message=str(exc))

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# POST /chat/vision — Multimodal image + text
# ---------------------------------------------------------------------------

@router.post("/vision", response_model=VisionChatResponse)
@traceable(
    name="SeoulWalk Vision Chat",
    run_type="chain",
    process_inputs=sanitize_trace_payload,
    process_outputs=sanitize_trace_payload,
)
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
    waypoint, gps_context = await _resolve_waypoint_context(
        req.waypoint_id,
        req.latitude,
        req.longitude,
    )

    image_artifact = save_base64_image_artifact(
        image_base64=req.image_base64,
        session_id=session_id,
        label="vision-upload",
        mime_type=req.image_mime_type,
        metadata={
            "source": "user_vision_upload",
            "latitude": req.latitude,
            "longitude": req.longitude,
            "waypoint_id": req.waypoint_id,
        },
    )

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
        "image_artifact": image_artifact,
    }

    return VisionChatResponse(
        reply=reply,
        session_id=session_id,
        waypoint_id=waypoint["id"] if waypoint else None,
        identified_subject=identified,
        debug_trace=debug_trace,
    )
