"""
chat.py — Chat & Vision Router

Endpoints:
  POST /chat         — Text chat with web search augmentation
  POST /chat/vision  — Multimodal image analysis + SeoulWalk finalization

Both share the same spatial context logic. Text chat uses OpenRouter first with
NVIDIA NIM as a fallback. Vision uses the same provider order for first-pass
evidence and the text model for final response policy.

Web Search Flow (Task 3):
  1. LLM classifier decides if the query needs live data (temperature=0)
  2. If yes: Tavily search → results injected into prompt as WEB_SEARCH_RESULTS
  3. LLM generates a cited, grounded answer

Vision Flow (Task 4):
  1. Base64 image + text message → vision model produces structured evidence
  2. Evidence is passed into the standard text-chat policy prompt
  3. Returns one TTS-friendly SeoulWalk reply
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
    VisionImageAnalysis,
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
from server.routers.handoff import build_naver_search_urls

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
- 2-4 short, clear sentences. Replies are plain natural language for chat and TTS.
- Do not use markdown formatting of any kind: no bullets, numbered lists,
  bold/italic markers, headings, tables, or code fences.
- When listing options, write them as spoken sentences: "First..., then..., finally..."
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

Your task is first-pass visual analysis only. You are not the final user-facing
assistant. The standard SeoulWalk chat model will make the final response using
route, itinerary, Naver handoff, safety, and anti-hallucination policies.

Analyze the submitted image and the user's image question. Capture evidence that
the final assistant can use. If you cannot confidently identify the subject, say
so honestly. Do not invent names, directions, open hours, route decisions, or
live availability.

CURRENT CONTEXT:
{gps_context}

Return compact JSON only with these keys:
- identified_subject: likely building, gate, object, sign, or artifact name; null if uncertain
- confidence: "low", "medium", or "high"
- visual_summary: one short sentence describing what is visible
- visible_text: visible Korean or English text and translation; null if none
- safety_or_weather_cues: only visible hazards or weather cues; null if none
- draft_answer: a brief first-pass answer to the user's image question
- uncertainties: short list of uncertainty notes
"""

_MAP_SNAPSHOT_NOTE = """\
MAP SNAPSHOT NOTE:
Any attached Naver static map is centered on the user's current location for
orientation only. The center marker is not a destination and does not mean the
user asked to navigate there. Navigation handoffs must use deterministic
geocoding/search payloads, not the map image alone.
"""


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _get_live_environment() -> str:
    """Fetch current time in Seoul and weather from Open-Meteo."""
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

    return f"- Current Time: {time_str}\n- Weather: {temp}°C, {weather_desc}\n- UV Index: {uv}\n- Air Quality (AQI): {aqi}"


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


def _extract_json_object(text: str) -> dict | None:
    """Best-effort JSON object extraction for LLM responses."""
    if not text:
        return None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    candidates = [cleaned]
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        candidates.append(match.group(0))

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def _string_or_none(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "n/a"}:
        return None
    return text


def _parse_vision_analysis(raw: str) -> VisionImageAnalysis:
    """Convert a vision LLM response into the internal analysis contract."""
    payload = _extract_json_object(raw) or {}
    if not payload:
        return VisionImageAnalysis(
            confidence="low",
            visual_summary=raw.strip()[:500] if raw else "",
            draft_answer=raw.strip() if raw else "I could not confidently analyze the image.",
            uncertainties=["Vision model returned unstructured output."],
        )

    uncertainties = payload.get("uncertainties") or []
    if isinstance(uncertainties, str):
        uncertainties = [uncertainties]
    elif not isinstance(uncertainties, list):
        uncertainties = []

    confidence = _string_or_none(payload.get("confidence")) or "low"
    confidence = confidence.lower()
    if confidence not in {"low", "medium", "high"}:
        confidence = "low"

    visual_summary = _string_or_none(payload.get("visual_summary")) or ""
    draft_answer = _string_or_none(payload.get("draft_answer")) or visual_summary

    return VisionImageAnalysis(
        identified_subject=_string_or_none(payload.get("identified_subject")),
        confidence=confidence,
        visual_summary=visual_summary,
        visible_text=_string_or_none(payload.get("visible_text")),
        safety_or_weather_cues=_string_or_none(payload.get("safety_or_weather_cues")),
        draft_answer=draft_answer,
        uncertainties=[str(item).strip() for item in uncertainties if str(item).strip()],
    )


def _format_vision_context_for_text_prompt(
    original_message: str,
    analysis: VisionImageAnalysis,
    image_artifact: dict | None,
) -> str:
    """Build the evidence block passed into the standard SeoulWalk text prompt."""
    uncertainty_text = "; ".join(analysis.uncertainties) if analysis.uncertainties else "None stated."
    image_path = image_artifact.get("path") if image_artifact else None
    return (
        "The user just submitted an image. Treat the following vision analysis as evidence, "
        "not as ground truth. If it conflicts with CURRENT CONTEXT, ITINERARY CONTEXT, "
        "or trusted search/geocoding results, explain the uncertainty briefly.\n\n"
        f"ORIGINAL USER MESSAGE:\n{original_message}\n\n"
        "IMAGE CONTEXT:\n"
        f"- Identified subject: {analysis.identified_subject or 'Uncertain'}\n"
        f"- Confidence: {analysis.confidence or 'low'}\n"
        f"- Visual summary: {analysis.visual_summary or 'No visual summary available.'}\n"
        f"- Visible text: {analysis.visible_text or 'None detected.'}\n"
        f"- Visible safety/weather cues: {analysis.safety_or_weather_cues or 'None detected.'}\n"
        f"- Vision draft answer: {analysis.draft_answer or 'No draft answer available.'}\n"
        f"- Vision uncertainties: {uncertainty_text}\n"
        f"- Local image artifact: {image_path or 'not saved'}"
    )


def _build_vision_routing_message(original_message: str, analysis: VisionImageAnalysis) -> str:
    """Keep intent/geocode classification grounded when the user refers to the image."""
    subject = analysis.identified_subject
    if not subject:
        return original_message

    lower = original_message.lower()
    image_references = (" this", " that", " there", " it", " here", "photo", "image", "picture")
    if any(token in f" {lower}" for token in image_references):
        return f"{original_message}\nImage identified subject: {subject}"
    return original_message


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
    provider: str = "openrouter",
) -> str:
    """
    Call the LLM via OpenRouter first, then NVIDIA NIM as fallback.
    Reasoning traces (<think>...</think>) are always stripped before returning.
    """
    providers = [provider]
    if provider == "openrouter":
        providers.append("nvidia")

    last_error: HTTPException | None = None
    for active_provider in providers:
        if active_provider == "openrouter":
            if not OPENROUTER_API_KEY:
                last_error = HTTPException(status_code=500, detail="Missing OpenRouter API key")
                continue
            url = OPENROUTER_BASE_URL
            api_key = OPENROUTER_API_KEY
            extra: dict = {}
        elif active_provider == "nvidia":
            if not NVIDIA_API_KEY:
                last_error = HTTPException(status_code=500, detail="Missing NVIDIA_API_KEY")
                continue
            url = NVIDIA_BASE_URL
            api_key = NVIDIA_API_KEY
            extra = {}
            if "reasoning" in model:
                extra["extra_body"] = {
                    "chat_template_kwargs": {"enable_thinking": True},
                    "reasoning_budget": 8192,
                }
        else:
            raise HTTPException(status_code=500, detail=f"Unknown LLM provider: {active_provider}")

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            **extra,
        }
        if active_provider == "openrouter":
            if model == "deepseek/deepseek-v4-flash":
                payload["provider"] = {
                    "only": ["alibaba"],
                    "allow_fallbacks": False
                }
            elif model == "xiaomi/mimo-v2.5":
                payload["provider"] = {
                    "only": ["xiaomi"],
                    "allow_fallbacks": False
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
            last_error = HTTPException(
                status_code=504,
                detail=f"Request to {active_provider} LLM API timed out.",
            )
            continue
        except httpx.RequestError as exc:
            last_error = HTTPException(
                status_code=502,
                detail=f"Failed to communicate with {active_provider} LLM API: {exc}",
            )
            continue

        if resp.status_code != 200:
            last_error = HTTPException(
                status_code=502,
                detail=f"{active_provider} API returned {resp.status_code}: {resp.text[:300]}",
            )
            continue

        raw = resp.json().get("choices", [{}])[0].get("message", {}).get("content") or ""
        return _strip_thinking(raw)

    raise last_error or HTTPException(status_code=500, detail="No LLM provider is configured")


async def _stream_llm(
    messages: list[dict],
    model: str,
    temperature: float = 0.7,
):
    """Stream OpenRouter chat completion deltas, falling back to NVIDIA NIM."""
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": True,
    }
    providers = [
        ("openrouter", OPENROUTER_BASE_URL, OPENROUTER_API_KEY),
        ("nvidia", NVIDIA_BASE_URL, NVIDIA_API_KEY),
    ]
    last_error: HTTPException | None = None
    for active_provider, url, api_key in providers:
        if not api_key:
            last_error = HTTPException(status_code=500, detail=f"Missing {active_provider} API key")
            continue

        active_payload = dict(payload)
        if active_provider == "openrouter":
            if model == "deepseek/deepseek-v4-flash":
                active_payload["provider"] = {
                    "only": ["alibaba"],
                    "allow_fallbacks": False
                }
            elif model == "xiaomi/mimo-v2.5":
                active_payload["provider"] = {
                    "only": ["xiaomi"],
                    "allow_fallbacks": False
                }

        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream",
                    },
                    json=active_payload,
                ) as resp:
                    if resp.status_code != 200:
                        text = await resp.aread()
                        last_error = HTTPException(
                            status_code=502,
                            detail=(
                                f"{active_provider} API returned {resp.status_code}: "
                                f"{text.decode('utf-8', errors='replace')[:300]}"
                            ),
                        )
                        continue

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
                    return
        except httpx.TimeoutException:
            last_error = HTTPException(status_code=504, detail=f"Request to {active_provider} LLM API timed out.")
        except httpx.RequestError as exc:
            last_error = HTTPException(status_code=502, detail=f"Failed to communicate with {active_provider} LLM API: {exc}")

    raise last_error or HTTPException(status_code=500, detail="No streaming LLM provider is configured")


async def _emit_prepare_status(status_callback, label: str):
    if status_callback:
        await status_callback(label)


def _build_naver_action_payload_from_geocode(
    query: str,
    results: list[dict],
    naver_search_query: str | None = None,
    display_query: str | None = None,
) -> dict | None:
    """Build a deterministic Naver search handoff from the best geocode result."""
    if not results:
        return None

    best = results[0]
    lat = best.get("latitude")
    lng = best.get("longitude")
    if lat is None or lng is None:
        return None

    place_name = (
        display_query
        or best.get("building_name")
        or best.get("road_address")
        or best.get("english_address")
        or naver_search_query
        or query
    )
    search_keyword = (
        naver_search_query
        or best.get("building_name")
        or query
    )
    urls = build_naver_search_urls(search_keyword, latitude=lat, longitude=lng)
    return {
        "place_name": place_name,
        "query": search_keyword,
        "naver_query": search_keyword,
        "latitude": lat,
        "longitude": lng,
        "naver_app_url": urls["naver_app_url"],
        "naver_web_url": urls["naver_web_url"],
        "handoff_type": "search",
    }


def _build_naver_action_payload_from_exact_search(
    query: str,
    naver_search_query: str | None,
    display_query: str | None,
    latitude: float | None,
    longitude: float | None,
) -> dict | None:
    """Build a Naver search handoff when geocoding did not return a target."""
    search_keyword = naver_search_query or query
    if not search_keyword:
        return None
    urls = build_naver_search_urls(search_keyword, latitude=latitude, longitude=longitude)
    return {
        "place_name": display_query or search_keyword,
        "query": search_keyword,
        "naver_query": search_keyword,
        "latitude": latitude,
        "longitude": longitude,
        "naver_app_url": urls["naver_app_url"],
        "naver_web_url": urls["naver_web_url"],
        "handoff_type": "search",
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
    (
        ("subway", "subways", "metro", "station", "stations", "train", "trains", "transit"),
        "subway station",
        "지하철역",
    ),
]

_WAYPOINT_NAVER_QUERIES = {
    "main_gate": "광화문 경복궁",
    "ticket_booth": "경복궁 매표소",
    "geunjeongjeon": "근정전 경복궁",
    "gyeonghoeru": "경회루 경복궁",
    "national_palace_museum": "국립고궁박물관",
    "heungnyemun": "흥례문 경복궁",
    "sajeongjeon": "사정전 경복궁",
    "gangnyeongjeon": "강녕전 경복궁",
    "gyotaejeon": "교태전 경복궁",
    "amisan": "아미산 경복궁",
    "hyangwonjeong": "향원정 경복궁",
    "national_folk_museum": "국립민속박물관",
    "sinmumun": "신무문 경복궁",
    "yeonchumun": "영추문 경복궁",
    "geonchunmun": "건춘문 경복궁",
    "sejong_statue": "세종대왕 동상 광화문광장",
    "yi_sun_sin_statue": "이순신 장군 동상 광화문광장",
    "cheonggyecheon_plaza": "청계천 광장",
    "gwanghwamun_station_9": "광화문역 9번 출구",
    "sejong_center": "세종문화회관",
}


def _naver_query_for_waypoint(waypoint: dict) -> str:
    """Return the Korean Naver keyword for a known waypoint."""
    return _WAYPOINT_NAVER_QUERIES.get(
        waypoint.get("id"),
        f"{waypoint['name']} 경복궁",
    )


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


def _is_contextual_place_reference(message: str) -> bool:
    """Detect direction requests where 'this/here' refers to attached waypoint context."""
    normalized = f" {message.lower()} "
    reference_terms = (
        "this place",
        "this spot",
        "this location",
        "this pin",
        "here",
        "where i am",
        "current place",
        "current location",
    )
    direction_terms = (
        "how do i get",
        "how can i get",
        "take me",
        "navigate",
        "directions",
        "route",
        "open naver",
        "show me",
        "map",
    )
    return any(term in normalized for term in reference_terms) and any(
        term in normalized for term in direction_terms
    )


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


async def _prepare_chat_completion(
    req: ChatRequest,
    status_callback=None,
    prompt_user_message: str | None = None,
) -> dict:
    """Build all context needed for either normal or streaming chat completion."""
    provider = "openrouter"
    model = req.model_override or LLM_MODEL_ID
    if not OPENROUTER_API_KEY and not NVIDIA_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OpenRouter and NVIDIA API keys")

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
    route = await classify_intent(
        user_message=req.message,
        last_ai_message=last_ai_message,
        provider=provider,
        model=model,
        return_route=True,
    )
    if isinstance(route, str):
        intent = route
        naver_search_query = None
        display_query = None
    else:
        intent = route["intent"]
        naver_search_query = route.get("naver_search_query")
        display_query = route.get("display_query")

    if intent == "MAP_GEOCODE" and waypoint and _is_contextual_place_reference(req.message):
        naver_search_query = _naver_query_for_waypoint(waypoint)
        display_query = waypoint["name"]

    print(f"🧠 Intent classification: {intent}")
    await _trace_chat_event(
        session_id,
        "chat_intent_classified",
        {
            "intent": intent,
            "model": model,
            "has_last_assistant_message": bool(last_ai_message),
            "naver_search_query": naver_search_query,
            "display_query": display_query,
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
        geocode_query = naver_search_query or req.message
        await _trace_chat_event(
            session_id,
            "chat_geocode_started",
            {
                "query": geocode_query,
                "original_message": req.message,
                "center_lat": lat,
                "center_lng": lng,
            },
        )
        geo_results = await geocode_search(query=geocode_query, center_lng=lng, center_lat=lat)
        await _trace_chat_event(session_id, "chat_geocode_completed", {"result_count": len(geo_results or [])})
        if geo_results:
            geocode_block = "\n\n" + format_geocoding_for_prompt(geo_results, geocode_query)
            naver_action_payload = _build_naver_action_payload_from_geocode(
                req.message,
                geo_results,
                naver_search_query=naver_search_query,
                display_query=display_query,
            )
        else:
            naver_action_payload = _build_naver_action_payload_from_exact_search(
                req.message,
                naver_search_query,
                display_query,
                latitude=lat,
                longitude=lng,
            )
        if naver_action_payload:
            await _trace_chat_event(
                session_id,
                "chat_naver_handoff_target_resolved",
                {
                    "place_name": naver_action_payload["place_name"] if naver_action_payload else None,
                    "naver_query": naver_action_payload.get("naver_query") if naver_action_payload else None,
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

    if (
        waypoint
        and not amenity_search
        and not naver_action_payload
        and _is_contextual_place_reference(req.message)
    ):
        waypoint_search_query = _naver_query_for_waypoint(waypoint)
        naver_action_payload = _build_naver_action_payload_from_exact_search(
            req.message,
            waypoint_search_query,
            waypoint["name"],
            latitude=lat,
            longitude=lng,
        )
        await _trace_chat_event(
            session_id,
            "chat_naver_handoff_target_resolved",
            {
                "place_name": naver_action_payload["place_name"],
                "naver_query": naver_action_payload["naver_query"],
                "latitude": naver_action_payload["latitude"],
                "longitude": naver_action_payload["longitude"],
                "source": "attached_waypoint_context",
            },
        )

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
    should_attach_map_snapshot = intent in {"MAP_STATIC", "MAP_GEOCODE"}
    if should_attach_map_snapshot and lat is not None and lng is not None:
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

    user_prompt_text = prompt_user_message or req.message
    user_content = user_prompt_text
    if map_snapshot_b64:
        model = VISION_MODEL_ID
        full_system += f"\n\n{_MAP_SNAPSHOT_NOTE}"
        user_content = [
            {"type": "text", "text": user_prompt_text},
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
        "prompt_user_message": user_prompt_text,
    }


async def _complete_prepared_chat(
    prepared: dict,
    history_user_message: str,
    trace_event_base: str = "chat_llm_response",
    debug_extra: dict | None = None,
) -> ChatResponse:
    """Run the policy-bearing text LLM pass and build a ChatResponse."""
    session_id = prepared["session_id"]
    waypoint = prepared["waypoint"]
    model = prepared["model"]
    provider = prepared["provider"]
    intent = prepared["intent"]
    messages = prepared["messages"]
    started_at = time.perf_counter()

    await _trace_chat_event(
        session_id,
        f"{trace_event_base}_started",
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
            f"{trace_event_base}_failed",
            {
                "provider": provider,
                "model": model,
                "intent": intent,
                "error_type": type(exc).__name__,
                "duration_ms": round((time.perf_counter() - started_at) * 1000),
            },
        )
        raise

    await save_chat_message(session_id, "user", history_user_message)
    await save_chat_message(session_id, "assistant", reply)

    naver_action_payload = prepared["naver_action_payload"]
    action = "OPEN_NAVER_MAP" if naver_action_payload else None
    await _trace_chat_event(
        session_id,
        f"{trace_event_base}_completed",
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
        "finalization_pipeline": "text_chat",
    }
    if debug_extra:
        debug_trace.update(debug_extra)

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        waypoint_id=waypoint["id"] if waypoint else None,
        action=action,
        action_payload=naver_action_payload,
        web_search_used=prepared["search_used"],
        debug_trace=debug_trace,
    )


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
    Text chat uses OpenRouter first, with NVIDIA NIM as fallback.
    """
    prepared = await _prepare_chat_completion(req)
    return await _complete_prepared_chat(prepared, history_user_message=req.message)


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
                    "provider": "openrouter",
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
            action = "OPEN_NAVER_MAP" if naver_action_payload else None
            await _trace_chat_event(
                session_id,
                "chat_llm_stream_completed",
                {
                    "provider": "openrouter",
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
    Uses OpenRouter first for first-pass visual evidence,
    then routes the final answer through the standard SeoulWalk text-chat policy.
    """
    if not OPENROUTER_API_KEY and not NVIDIA_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OpenRouter and NVIDIA API keys")

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

    # Build multimodal message using the OpenAI-compatible content array format.
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

    await _trace_chat_event(
        session_id,
        "vision_analysis_started",
        {
            "model": VISION_MODEL_ID,
            "waypoint_id": waypoint["id"] if waypoint else None,
            "image_artifact": image_artifact,
        },
    )
    vision_raw = await _call_llm(
        messages=[
            {"role": "system", "content": vision_system},
            {"role": "user", "content": user_content},
        ],
        model=VISION_MODEL_ID,
        temperature=0.4,
        provider="openrouter",
    )
    analysis = _parse_vision_analysis(vision_raw)
    await _trace_chat_event(
        session_id,
        "vision_analysis_completed",
        {
            "identified_subject": analysis.identified_subject,
            "confidence": analysis.confidence,
            "has_visible_text": bool(analysis.visible_text),
            "uncertainty_count": len(analysis.uncertainties),
        },
    )

    final_prompt_message = _format_vision_context_for_text_prompt(
        req.message,
        analysis,
        image_artifact,
    )
    routing_message = _build_vision_routing_message(req.message, analysis)
    final_req = ChatRequest(
        message=routing_message,
        session_id=session_id,
        latitude=req.latitude,
        longitude=req.longitude,
        waypoint_id=req.waypoint_id,
    )

    prepared = await _prepare_chat_completion(
        final_req,
        prompt_user_message=final_prompt_message,
    )
    final_response = await _complete_prepared_chat(
        prepared,
        history_user_message=f"[Photo attached] {req.message}",
        trace_event_base="vision_final_llm_response",
        debug_extra={
            "vision_pipeline": "vision_analysis_then_text_chat",
            "vision_model": VISION_MODEL_ID,
            "vision_raw_response": vision_raw,
            "vision_analysis": analysis.model_dump(),
            "vision_prompt": vision_system,
            "image_artifact": image_artifact,
        },
    )

    debug_trace = final_response.debug_trace or {}

    return VisionChatResponse(
        reply=final_response.reply,
        session_id=final_response.session_id,
        waypoint_id=final_response.waypoint_id,
        action=final_response.action,
        action_payload=final_response.action_payload,
        web_search_used=final_response.web_search_used,
        identified_subject=analysis.identified_subject,
        debug_trace=debug_trace,
    )
