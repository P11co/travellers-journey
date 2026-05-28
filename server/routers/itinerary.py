"""
itinerary.py — Itinerary Generation & CRUD Router

Endpoints:
  POST   /itinerary/generate          — LLM-powered itinerary creation
  GET    /itinerary/{session_id}       — Retrieve a saved itinerary
  PUT    /itinerary/{session_id}/reorder — Reorder stops
  DELETE /itinerary/{session_id}       — Delete a session + itinerary
"""

from __future__ import annotations

import json
import re
import uuid
from fastapi import APIRouter, HTTPException

from server.config import HOTSPOTS, LLM_MODEL_ID, WAYPOINTS
from server.models import (
    ItineraryGenerateRequest,
    ItineraryResponse,
    ItineraryItem,
    ItineraryReorderRequest,
)
from server.database import (
    create_session,
    get_session,
    save_itinerary_items,
    get_itinerary_items,
    reorder_itinerary,
    delete_session,
)
from server.routers.handoff import build_naver_urls
from server.routers.chat import _call_llm

router = APIRouter(prefix="/itinerary", tags=["Itinerary"])


# ---------------------------------------------------------------------------
# LLM prompt for itinerary generation
# ---------------------------------------------------------------------------
_ITINERARY_SYSTEM_PROMPT = """\
You are SeoulWalk Itinerary Planner. Given a tourist's constraints, generate \
a structured walking route as a JSON array.

RULES:
- Output ONLY a valid JSON array — no markdown, no extra text.
- Each element must have exactly these keys:
  "order" (int, starting at 1),
  "time" (string, e.g. "10:00 AM"),
  "place" (string, the location name),
  "activity" (string, what to do there),
  "duration_minutes" (int),
  "estimated_cost_krw" (int, 0 if free),
  "latitude" (float or null),
  "longitude" (float or null)
- Include travel/walking time between locations as separate items if needed.
- Treat available time as a maximum, not a target to fill.
- Selected hotspots are hard constraints, not loose suggestions.
- Do not invent new places, restaurants, cafes, museums, palaces, streets, or parks.
- If fill mode is disabled, use only selected hotspots plus utility items like "Walking to X" or generic "Rest break".
- If fill mode is enabled, extra stops must come only from the provided fill pool of known hotspots.
- Use the exact provided coordinates for hotspot stops. Utility items must use null coordinates.
"""

_REQUIRED_ITEM_KEYS = {
    "order",
    "time",
    "place",
    "activity",
    "duration_minutes",
    "estimated_cost_krw",
    "latitude",
    "longitude",
}


def _normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _parse_time_to_minutes(value: str | None) -> int:
    match = re.match(r"^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$", (value or "").strip(), re.I)
    if not match:
        return 9 * 60

    hours = int(match.group(1))
    minutes = int(match.group(2))
    meridiem = match.group(3).upper() if match.group(3) else None
    if meridiem == "PM" and hours != 12:
        hours += 12
    if meridiem == "AM" and hours == 12:
        hours = 0
    return hours * 60 + minutes


def _format_minutes_as_time(total_minutes: int) -> str:
    normalized = total_minutes % (24 * 60)
    hours_24 = normalized // 60
    minutes = normalized % 60
    meridiem = "PM" if hours_24 >= 12 else "AM"
    hours_12 = hours_24 % 12 or 12
    return f"{hours_12:02d}:{minutes:02d} {meridiem}"


def _resolve_hotspots(names: list[str]) -> list[dict]:
    hotspots_by_name = {_normalize_name(hotspot["name"]): hotspot for hotspot in HOTSPOTS}
    resolved = []
    seen = set()
    for name in names:
        hotspot = hotspots_by_name.get(_normalize_name(name))
        if hotspot and hotspot["id"] not in seen:
            resolved.append(hotspot)
            seen.add(hotspot["id"])
    return resolved


def _format_hotspot_lines(hotspots: list[dict]) -> str:
    if not hotspots:
        return "- None"
    return "\n".join(
        (
            f'- {hotspot["name"]}: duration={hotspot["est_duration_mins"]} min, '
            f'lat={hotspot["lat"]}, lng={hotspot["lng"]}, '
            f'description="{hotspot["short_desc"]}"'
        )
        for hotspot in hotspots
    )


def _known_fill_hotspots(selected_hotspots: list[dict]) -> list[dict]:
    selected_ids = {hotspot["id"] for hotspot in selected_hotspots}
    return [hotspot for hotspot in HOTSPOTS if hotspot["id"] not in selected_ids]


def _build_user_prompt(req: ItineraryGenerateRequest) -> str:
    budget_text = f"{req.budget_krw:,} KRW" if req.budget_krw else "No budget constraint"
    selected_hotspots = _resolve_hotspots(req.hotspots)
    selected_names = ", ".join(hotspot["name"] for hotspot in selected_hotspots) or ", ".join(req.hotspots)
    fill_pool = _known_fill_hotspots(selected_hotspots) if req.allow_ai_fill else []
    waypoint_info = ""
    if WAYPOINTS:
        waypoint_info = (
            f"\n\nKnown waypoints with exact GPS coordinates:\n"
            + "\n".join(
                f'- {wp["name"]}: lat={wp["coordinates"]["latitude"]}, lng={wp["coordinates"]["longitude"]}'
                for wp in WAYPOINTS
            )
        )

    return (
        f"Location: {req.location}\n"
        f"Selected hotspots: {selected_names}\n"
        f"Selected hotspot details:\n{_format_hotspot_lines(selected_hotspots)}\n"
        f"AI fill mode: {'enabled' if req.allow_ai_fill else 'disabled'}\n"
        f"Known fill pool, only usable when AI fill mode is enabled:\n{_format_hotspot_lines(fill_pool)}\n"
        f"Budget: {budget_text}\n"
        f"Maximum available time: {req.available_hours} hours starting at {req.start_time}\n"
        f"If the selected hotspots take less time than the maximum, do not pad the route unless fill mode is enabled.\n"
        f"{waypoint_info}"
    )


def _hotspot_to_item(hotspot: dict) -> dict:
    return {
        "order": 0,
        "time": "",
        "place": hotspot["name"],
        "activity": hotspot["short_desc"],
        "duration_minutes": int(hotspot["est_duration_mins"]),
        "estimated_cost_krw": 0,
        "latitude": float(hotspot["lat"]),
        "longitude": float(hotspot["lng"]),
    }


def _fallback_itinerary_items(req: ItineraryGenerateRequest) -> list[dict]:
    selected_hotspots = _resolve_hotspots(req.hotspots)
    if selected_hotspots:
        return _recalculate_item_schedule(
            [_hotspot_to_item(hotspot) for hotspot in selected_hotspots],
            req.start_time,
        )

    return _recalculate_item_schedule(
        [{
            "order": 0,
            "time": "",
            "place": req.location,
            "activity": "Explore the selected area at a relaxed pace.",
            "duration_minutes": 60,
            "estimated_cost_krw": 0,
            "latitude": None,
            "longitude": None,
        }],
        req.start_time,
    )


def _extract_json_array(raw_content: str) -> str:
    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        cleaned = cleaned.rsplit("```", 1)[0]

    match = re.search(r"\[[\s\S]*\]", cleaned)
    return match.group(0) if match else cleaned


def _parse_itinerary_items(raw_content: str) -> list[dict]:
    items = json.loads(_extract_json_array(raw_content))
    if not isinstance(items, list):
        raise ValueError("Expected a JSON array")

    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Each itinerary item must be an object")
        missing = _REQUIRED_ITEM_KEYS - set(item)
        if missing:
            raise ValueError(f"Missing itinerary item keys: {sorted(missing)}")

    return items


def _is_utility_item(item: dict) -> bool:
    text = f'{item.get("place", "")} {item.get("activity", "")}'.lower()
    return any(
        keyword in text
        for keyword in ("walk", "walking", "travel", "transit", "rest break", "lunch break")
    )


def _merge_known_hotspot_item(item: dict, hotspot: dict) -> dict:
    return {
        **item,
        "place": hotspot["name"],
        "duration_minutes": int(item.get("duration_minutes") or hotspot["est_duration_mins"]),
        "latitude": float(hotspot["lat"]),
        "longitude": float(hotspot["lng"]),
    }


def _filter_known_items(items: list[dict], req: ItineraryGenerateRequest) -> list[dict]:
    selected_hotspots = _resolve_hotspots(req.hotspots)
    allowed_hotspots = selected_hotspots + (_known_fill_hotspots(selected_hotspots) if req.allow_ai_fill else [])
    allowed_by_name = {_normalize_name(hotspot["name"]): hotspot for hotspot in allowed_hotspots}
    selected_names = {_normalize_name(hotspot["name"]) for hotspot in selected_hotspots}

    filtered = []
    selected_seen = set()
    for item in items:
        normalized_place = _normalize_name(str(item.get("place", "")))
        known_hotspot = allowed_by_name.get(normalized_place)
        if known_hotspot:
            filtered.append(_merge_known_hotspot_item(item, known_hotspot))
            if normalized_place in selected_names:
                selected_seen.add(normalized_place)
            continue

        if _is_utility_item(item):
            filtered.append({
                **item,
                "latitude": None,
                "longitude": None,
            })

    # Ensure strict mode cannot accidentally omit a selected destination.
    for hotspot in selected_hotspots:
        normalized_name = _normalize_name(hotspot["name"])
        if normalized_name not in selected_seen:
            filtered.append(_hotspot_to_item(hotspot))

    filtered = _trim_optional_items_to_available_time(filtered, req, selected_names)
    return _recalculate_item_schedule(filtered or _fallback_itinerary_items(req), req.start_time)


def _trim_optional_items_to_available_time(
    items: list[dict],
    req: ItineraryGenerateRequest,
    selected_names: set[str],
) -> list[dict]:
    max_minutes = int(req.available_hours * 60)
    if max_minutes <= 0:
        return items

    running_minutes = 0
    trimmed = []
    for item in items:
        duration = int(item.get("duration_minutes") or 60)
        is_selected_hotspot = _normalize_name(str(item.get("place", ""))) in selected_names
        if running_minutes + duration <= max_minutes or is_selected_hotspot:
            trimmed.append(item)
            running_minutes += duration

    return trimmed


def _recalculate_item_schedule(items: list[dict], start_time: str) -> list[dict]:
    running_minutes = _parse_time_to_minutes(start_time)
    scheduled = []
    for order, item in enumerate(items, start=1):
        duration = int(item.get("duration_minutes") or 60)
        scheduled.append({
            **item,
            "order": order,
            "time": _format_minutes_as_time(running_minutes),
            "duration_minutes": duration,
        })
        running_minutes += duration
    return scheduled


async def call_llm_for_itinerary(req: ItineraryGenerateRequest) -> list[dict]:
    """Call the same default chat model/provider to generate itinerary JSON."""
    user_prompt = _build_user_prompt(req)
    try:
        raw_content = await _call_llm(
            messages=[
                {"role": "system", "content": _ITINERARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            model=LLM_MODEL_ID,
            temperature=0.4,
            provider="nvidia",
        )
        return _filter_known_items(_parse_itinerary_items(raw_content), req)
    except (HTTPException, json.JSONDecodeError, ValueError) as exc:
        print(f"⚠️ Falling back to deterministic itinerary: {exc}")
        return _fallback_itinerary_items(req)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=ItineraryResponse)
async def generate_itinerary(req: ItineraryGenerateRequest):
    """Generate an AI-powered itinerary and persist it."""
    # 1. Create or reuse session
    session_id = req.session_id or str(uuid.uuid4())
    existing = await get_session(session_id)
    if not existing:
        await create_session(session_id, location=req.location)

    # 2. Call LLM
    raw_items = await call_llm_for_itinerary(req)

    # 3. Enrich items with Naver Map URLs where coordinates exist
    enriched_items = []
    for item in raw_items:
        lat = item.get("latitude")
        lng = item.get("longitude")
        naver_url = None
        if lat and lng:
            urls = build_naver_urls(item.get("place", ""), lat, lng)
            naver_url = urls["naver_app_url"]
        enriched_items.append({**item, "naver_map_url": naver_url})

    # 4. Persist
    await save_itinerary_items(session_id, enriched_items)

    # 5. Build response
    total_cost = sum(item.get("estimated_cost_krw", 0) for item in enriched_items)
    session_data = await get_session(session_id)

    return ItineraryResponse(
        session_id=session_id,
        location=req.location,
        items=[ItineraryItem(**item) for item in enriched_items],
        total_estimated_cost_krw=total_cost,
        created_at=session_data["created_at"] if session_data else None,
    )


@router.get("/{session_id}", response_model=ItineraryResponse)
async def get_itinerary(session_id: str):
    """Retrieve a previously saved itinerary."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    items = await get_itinerary_items(session_id)
    if not items:
        raise HTTPException(status_code=404, detail="No itinerary found for this session")

    total_cost = sum(item.get("estimated_cost_krw", 0) for item in items)
    return ItineraryResponse(
        session_id=session_id,
        location=session["location"],
        items=[ItineraryItem(**item) for item in items],
        total_estimated_cost_krw=total_cost,
        created_at=session["created_at"],
    )


@router.put("/{session_id}/reorder", response_model=ItineraryResponse)
async def reorder(session_id: str, req: ItineraryReorderRequest):
    """Reorder itinerary stops."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    success = await reorder_itinerary(session_id, req.item_order)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Invalid reorder request — check that item_order contains all existing order values.",
        )

    # Return updated itinerary
    items = await get_itinerary_items(session_id)
    total_cost = sum(item.get("estimated_cost_krw", 0) for item in items)
    return ItineraryResponse(
        session_id=session_id,
        location=session["location"],
        items=[ItineraryItem(**item) for item in items],
        total_estimated_cost_krw=total_cost,
        created_at=session["created_at"],
    )


@router.delete("/{session_id}")
async def delete(session_id: str):
    """Delete a session and its itinerary."""
    deleted = await delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted", "session_id": session_id}
