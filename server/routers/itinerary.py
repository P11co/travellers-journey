"""
itinerary.py — Itinerary Generation & CRUD Router

Endpoints:
  POST   /itinerary/generate          — LLM-powered itinerary creation
  GET    /itinerary/{session_id}       — Retrieve a saved itinerary
  PUT    /itinerary/{session_id}/reorder — Reorder stops
  DELETE /itinerary/{session_id}       — Delete a session + itinerary
"""

from __future__ import annotations

import asyncio
import itertools
import json
import re
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
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
from server.services.langsmith_tracing import traceable
from server.services.routing import get_travel_leg

router = APIRouter(prefix="/itinerary", tags=["Itinerary"])


_ITINERARY_SYSTEM_PROMPT = """\
You are SeoulWalk Itinerary Copy Editor.

You will receive a fixed itinerary skeleton. You must preserve:
- item count
- item order
- time
- place
- duration_minutes
- estimated_cost_krw
- latitude
- longitude

You may only rewrite the activity field for destination stops.
For travel legs such as "Walk to X" or "Taxi to X", keep the activity short and do not change duration.
Return only valid JSON.
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

_SEOUL_TZ = ZoneInfo("Asia/Seoul")
_WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
_WEEKDAY_LABELS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_PUBLIC_TRANSPORT_START_MINUTES = 6 * 60
_PUBLIC_TRANSPORT_END_MINUTES = 24 * 60


def _current_service_datetime() -> datetime:
    return datetime.now(_SEOUL_TZ)


def _normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _parse_time_to_minutes(value: str | None) -> int:
    match = re.match(r"^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$", (value or "").strip(), re.I)
    if not match:
        raise ValueError(f"Invalid time format: {value}")

    hours = int(match.group(1))
    minutes = int(match.group(2))
    meridiem = match.group(3).upper() if match.group(3) else None

    if minutes > 59:
        raise ValueError(f"Time out of range: {value}")
    if meridiem and (hours < 1 or hours > 12):
        raise ValueError(f"Time out of range: {value}")
    if not meridiem and (hours < 0 or hours > 23):
        raise ValueError(f"Time out of range: {value}")

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


def _parse_hours_time_to_minutes(value: str | None) -> int:
    match = re.match(r"^(\d{1,2}):(\d{2})$", (value or "").strip())
    if not match:
        raise ValueError(f"Invalid opening-hours time format: {value}")

    hours = int(match.group(1))
    minutes = int(match.group(2))
    if minutes > 59 or hours < 0 or hours > 24 or (hours == 24 and minutes != 0):
        raise ValueError(f"Opening-hours time out of range: {value}")
    return hours * 60 + minutes


def _minutes_display(total_minutes: int) -> str:
    if total_minutes == 24 * 60:
        return "midnight"
    return _format_minutes_as_time(total_minutes).lstrip("0")


def _hotspot_by_normalized_name(name: str) -> dict | None:
    normalized = _normalize_name(name)
    for hotspot in HOTSPOTS:
        if _normalize_name(hotspot["name"]) == normalized:
            return hotspot
    return None


def _waypoint_by_normalized_name(name: str) -> dict | None:
    normalized = _normalize_name(name)
    aliases = {
        "gwanghwamun gate": "main_gate",
        "gyeongbokgung gate": "main_gate",
        "main gate": "main_gate",
        "gyeongbokgung palace": "h_001",
    }
    alias_id = aliases.get(normalized)
    for waypoint in WAYPOINTS:
        if waypoint.get("id") == alias_id or _normalize_name(waypoint["name"]) == normalized:
            return waypoint
    return None


def _image_url_for_item(item: dict) -> str | None:
    if _is_utility_item(item):
        return None

    place = str(item.get("place", ""))
    hotspot = _hotspot_by_normalized_name(place)
    if hotspot and hotspot.get("image_url"):
        return hotspot["image_url"]

    waypoint = _waypoint_by_normalized_name(place)
    if waypoint and waypoint.get("image_url"):
        return waypoint["image_url"]

    return None


def _with_image_urls(items: list[dict]) -> list[dict]:
    return [
        {
            **item,
            "image_url": item.get("image_url") or _image_url_for_item(item),
        }
        for item in items
    ]


def _is_last_monday(service_dt: datetime) -> bool:
    return (
        service_dt.weekday() == 0
        and (service_dt + timedelta(days=7)).month != service_dt.month
    )


def _closed_day_reason(hotspot: dict, service_dt: datetime) -> str | None:
    opening_hours = hotspot.get("opening_hours") or {}
    weekday_index = service_dt.weekday()
    weekday = _WEEKDAY_KEYS[weekday_index]
    if weekday in opening_hours.get("closed_weekdays", []):
        return f"{hotspot['name']} is closed on {_WEEKDAY_LABELS[weekday_index]}s."
    if "last_monday" in opening_hours.get("closed_rules", []) and _is_last_monday(service_dt):
        return f"{hotspot['name']} is closed on the last Monday of each month."
    return None


def _windows_for_hotspot(hotspot: dict, service_dt: datetime) -> tuple[list[dict], str | None]:
    opening_hours = hotspot.get("opening_hours") or {}
    if opening_hours.get("status") == "unavailable":
        return [], opening_hours.get("display") or f"{hotspot['name']} is unavailable."

    closed_reason = _closed_day_reason(hotspot, service_dt)
    if closed_reason:
        return [], closed_reason

    weekday = _WEEKDAY_KEYS[service_dt.weekday()]
    weekday_windows = opening_hours.get("weekday_windows") or {}
    if weekday in weekday_windows:
        return weekday_windows[weekday], None

    for seasonal_window in opening_hours.get("seasonal_windows") or []:
        if service_dt.month in seasonal_window.get("months", []):
            return [seasonal_window], None

    return opening_hours.get("windows") or [], None


def _window_allows_visit(start_minutes: int, duration_minutes: int, window: dict) -> bool:
    open_minutes = _parse_hours_time_to_minutes(window.get("open"))
    close_minutes = _parse_hours_time_to_minutes(window.get("close"))

    adjusted_start = start_minutes
    adjusted_close = close_minutes
    if close_minutes <= open_minutes:
        adjusted_close += 24 * 60
        if adjusted_start < open_minutes:
            adjusted_start += 24 * 60

    return open_minutes <= adjusted_start and adjusted_start + duration_minutes <= adjusted_close


def _can_visit_hotspot_at(
    hotspot: dict,
    start_minutes: int,
    duration_minutes: int,
    service_dt: datetime,
) -> tuple[bool, str]:
    windows, closed_reason = _windows_for_hotspot(hotspot, service_dt)
    opening_hours = hotspot.get("opening_hours") or {}
    display = opening_hours.get("display") or "Hours unavailable"

    if closed_reason:
        return False, closed_reason
    if not windows:
        return False, f"{hotspot['name']} has no known open hours."
    if any(_window_allows_visit(start_minutes, duration_minutes, window) for window in windows):
        return True, display
    return False, (
        f"{hotspot['name']} is not open long enough at {_minutes_display(start_minutes)}. "
        f"Hours: {display}."
    )


def _is_hotspot_available(hotspot: dict) -> bool:
    return (hotspot.get("opening_hours") or {}).get("status") != "unavailable"


def _hours_conflict_payload(
    hotspot: dict,
    start_minutes: int,
    duration_minutes: int,
    service_dt: datetime,
) -> dict | None:
    can_visit, reason = _can_visit_hotspot_at(hotspot, start_minutes, duration_minutes, service_dt)
    if can_visit:
        return None

    opening_hours = hotspot.get("opening_hours") or {}
    return {
        "name": hotspot["name"],
        "scheduled_time": _format_minutes_as_time(start_minutes),
        "duration_minutes": int(duration_minutes),
        "hours": opening_hours.get("display") or "Hours unavailable",
        "source_url": opening_hours.get("source_url"),
        "reason": reason,
    }


def _collect_closed_destination_conflicts(skeleton: list[dict], service_dt: datetime) -> list[dict]:
    conflicts = []
    for item in skeleton:
        if _is_utility_item(item):
            continue
        hotspot = _hotspot_by_normalized_name(str(item.get("place", "")))
        if not hotspot:
            continue
        start_minutes = _parse_time_to_minutes(str(item.get("time")))
        duration_minutes = int(item.get("duration_minutes") or 0)
        conflict = _hours_conflict_payload(hotspot, start_minutes, duration_minutes, service_dt)
        if conflict:
            conflicts.append(conflict)
    return conflicts


def _selected_hotspots_open_at_start(selected_hotspots: list[dict], start_time: str, service_dt: datetime) -> list[dict]:
    start_minutes = _parse_time_to_minutes(start_time)
    open_hotspots = []
    for hotspot in selected_hotspots:
        duration_minutes = int(hotspot.get("est_duration_mins", 60))
        can_visit, _ = _can_visit_hotspot_at(hotspot, start_minutes, duration_minutes, service_dt)
        if can_visit:
            open_hotspots.append(hotspot)
    return open_hotspots


def _assert_public_transport_available(start_time: str):
    start_minutes = _parse_time_to_minutes(start_time)
    if not (_PUBLIC_TRANSPORT_START_MINUTES <= start_minutes < _PUBLIC_TRANSPORT_END_MINUTES):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "itinerary_public_transport_unavailable",
                "message": "Tours can start from 6:00 AM through midnight, when Seoul public transport is broadly available.",
                "start_time": _format_minutes_as_time(start_minutes),
                "allowed_start": "06:00",
                "allowed_end": "24:00",
            },
        )


def _raise_unavailable_hotspots(selected_hotspots: list[dict]):
    unavailable = [
        {
            "name": hotspot["name"],
            "hours": (hotspot.get("opening_hours") or {}).get("display") or "Unavailable",
            "source_url": (hotspot.get("opening_hours") or {}).get("source_url"),
        }
        for hotspot in selected_hotspots
        if not _is_hotspot_available(hotspot)
    ]
    if not unavailable:
        return

    names = ", ".join(item["name"] for item in unavailable)
    raise HTTPException(
        status_code=400,
        detail={
            "code": "itinerary_hotspot_unavailable",
            "message": f"{names} is not available for public visits. Remove it before generating the itinerary.",
            "closed_hotspots": unavailable,
        },
    )


def _raise_no_open_hotspots_at_start(
    selected_hotspots: list[dict],
    start_time: str,
    service_dt: datetime,
):
    if not selected_hotspots or _selected_hotspots_open_at_start(selected_hotspots, start_time, service_dt):
        return

    start_minutes = _parse_time_to_minutes(start_time)
    closed_hotspots = [
        _hours_conflict_payload(
            hotspot,
            start_minutes,
            int(hotspot.get("est_duration_mins", 60)),
            service_dt,
        )
        for hotspot in selected_hotspots
    ]
    raise HTTPException(
        status_code=400,
        detail={
            "code": "itinerary_no_open_hotspots_at_start",
            "message": "None of the selected stops are open at the requested start time. Choose a later start time or select an open outdoor stop.",
            "start_time": _format_minutes_as_time(start_minutes),
            "closed_hotspots": [item for item in closed_hotspots if item],
        },
    )


def _raise_closed_destination_conflicts(conflicts: list[dict]):
    if not conflicts:
        return

    if len(conflicts) == 1:
        reason = conflicts[0].get("reason")
        message = (
            f"{reason} Choose a different start time or remove it."
            if reason
            else f"{conflicts[0]['name']} is closed at {conflicts[0]['scheduled_time']}. Choose a different start time or remove it."
        )
    else:
        names = ", ".join(conflict["name"] for conflict in conflicts)
        message = f"These stops are closed at their scheduled times: {names}. Choose a different start time or remove them."

    raise HTTPException(
        status_code=400,
        detail={
            "code": "itinerary_hotspots_closed",
            "message": message,
            "closed_hotspots": conflicts,
        },
    )


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


async def _build_travel_matrix(hotspots: list[dict]) -> dict:
    """
    Builds a matrix (dict of dicts) mapping (from_id, to_id) -> leg_dict.
    Uses asyncio.gather to resolve all leg requests concurrently.
    """
    matrix = {}
    if not hotspots or len(hotspots) <= 1:
        return matrix
    
    pairs = []
    for h1, h2 in itertools.permutations(hotspots, 2):
        pairs.append((h1, h2))
        
    legs = await asyncio.gather(*[
        get_travel_leg(h1["lat"], h1["lng"], h2["lat"], h2["lng"])
        for h1, h2 in pairs
    ])
    
    for (h1, h2), leg in zip(pairs, legs):
        if h1["id"] not in matrix:
            matrix[h1["id"]] = {}
        matrix[h1["id"]][h2["id"]] = leg
        
    return matrix


async def _optimize_hotspot_route(
    hotspots: list[dict],
    travel_matrix: dict,
    start_time: str | None = None,
    service_dt: datetime | None = None,
) -> list[dict]:
    """
    Finds the lowest-travel permutation. When service hours are available, prefer
    permutations whose deterministic schedule keeps every destination open.
    """
    if len(hotspots) <= 1:
        return hotspots
        
    best_perm = list(hotspots)
    best_open_perm = None
    min_travel_time = float("inf")
    min_open_travel_time = float("inf")
    
    for perm in itertools.permutations(hotspots):
        current_travel = 0
        for i in range(len(perm) - 1):
            h_from = perm[i]
            h_to = perm[i+1]
            leg = travel_matrix.get(h_from["id"], {}).get(h_to["id"], {})
            current_travel += leg.get("duration_minutes", 15)
            
        if current_travel < min_travel_time:
            min_travel_time = current_travel
            best_perm = list(perm)

        if start_time and service_dt:
            skeleton = _build_deterministic_skeleton(list(perm), start_time, travel_matrix)
            if not _collect_closed_destination_conflicts(skeleton, service_dt) and current_travel < min_open_travel_time:
                min_open_travel_time = current_travel
                best_open_perm = list(perm)
            
    return best_open_perm or best_perm


def _build_deterministic_skeleton(
    ordered_hotspots: list[dict], start_time: str, travel_matrix: dict
) -> list[dict]:
    """
    Builds the deterministic schedule items containing stops and travel legs.
    """
    if not ordered_hotspots:
        return []
        
    items = []
    running_minutes = _parse_time_to_minutes(start_time)
    
    for idx, hotspot in enumerate(ordered_hotspots):
        # 1. Add the hotspot itself
        visit_duration = int(hotspot.get("est_duration_mins", 60))
        items.append({
            "order": len(items) + 1,
            "time": _format_minutes_as_time(running_minutes),
            "place": hotspot["name"],
            "activity": hotspot["short_desc"],
            "duration_minutes": visit_duration,
            "estimated_cost_krw": 0,
            "latitude": float(hotspot["lat"]),
            "longitude": float(hotspot["lng"]),
            "routing_source": None,
        })
        running_minutes += visit_duration
        
        # 2. Add the travel leg if there is a next hotspot
        if idx < len(ordered_hotspots) - 1:
            h_next = ordered_hotspots[idx + 1]
            leg = travel_matrix.get(hotspot["id"], {}).get(h_next["id"], {})
            mode = leg.get("mode", "walk")
            leg_duration = leg.get("duration_minutes", 15)
            routing_src = leg.get("routing_source", "fallback")
            
            mode_cap = mode.capitalize()
            items.append({
                "order": len(items) + 1,
                "time": _format_minutes_as_time(running_minutes),
                "place": f"{mode_cap} to {h_next['name']}",
                "activity": f"{mode_cap} from {hotspot['name']} to {h_next['name']}.",
                "duration_minutes": leg_duration,
                "estimated_cost_krw": 0,
                "latitude": None,
                "longitude": None,
                "routing_source": routing_src,
            })
            running_minutes += leg_duration
            
    return items


# Hard cap on total hotspots (selected + AI fill) to prevent factorial permutation blow-up.
_MAX_HOTSPOTS = 7


async def _fill_and_optimize_route(
    selected_hotspots: list[dict],
    allow_ai_fill: bool,
    available_hours: float,
    start_time: str,
    service_dt: datetime,
) -> tuple[list[dict], dict]:
    """
    Finds the optimal set of hotspots (including AI fills if allowed) and their optimized order.
    The combined total of selected + fill hotspots is capped at _MAX_HOTSPOTS (7) to avoid
    factorial permutation cost in _optimize_hotspot_route.
    """
    current_hotspots = list(selected_hotspots)
    travel_matrix = await _build_travel_matrix(current_hotspots)
    ordered = await _optimize_hotspot_route(current_hotspots, travel_matrix, start_time, service_dt)
    
    if not allow_ai_fill:
        return ordered, travel_matrix
        
    fill_pool = _known_fill_hotspots(selected_hotspots)
    available_minutes = available_hours * 60
    
    for candidate in fill_pool:
        # Enforce hard cap: never exceed _MAX_HOTSPOTS total stops.
        if len(current_hotspots) >= _MAX_HOTSPOTS:
            break

        test_hotspots = current_hotspots + [candidate]
        test_matrix = await _build_travel_matrix(test_hotspots)
        test_ordered = await _optimize_hotspot_route(test_hotspots, test_matrix, start_time, service_dt)
        test_skeleton = _build_deterministic_skeleton(test_ordered, start_time, test_matrix)
        total_time = sum(item["duration_minutes"] for item in test_skeleton)
        
        if total_time <= available_minutes and not _collect_closed_destination_conflicts(test_skeleton, service_dt):
            current_hotspots = test_hotspots
            travel_matrix = test_matrix
            ordered = test_ordered
            
    return ordered, travel_matrix


def _known_fill_hotspots(selected_hotspots: list[dict]) -> list[dict]:
    selected_ids = {hotspot["id"] for hotspot in selected_hotspots}
    return [
        hotspot
        for hotspot in HOTSPOTS
        if hotspot["id"] not in selected_ids and _is_hotspot_available(hotspot)
    ]


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


# Travel legs generated by _build_deterministic_skeleton always have:
#   1. Null latitude / longitude
#   2. A place that starts with "Walk to " or "Taxi to "
# Checking these two structural properties is far more reliable than scanning
# descriptive text, which can misfire on real destinations that mention
# walking (e.g. "Deoksugung Stone-wall Road").
_TRAVEL_LEG_PREFIXES = ("walk to ", "taxi to ")


def _is_utility_item(item: dict) -> bool:
    """Return True only for generated travel legs (Walk to / Taxi to), not real destinations."""
    if item.get("latitude") is not None or item.get("longitude") is not None:
        # Real destinations always have coordinates – never a travel leg.
        return False
    place_lower = item.get("place", "").lower()
    return any(place_lower.startswith(prefix) for prefix in _TRAVEL_LEG_PREFIXES)


def _validate_llm_itinerary(parsed_items: list[dict], skeleton: list[dict]) -> list[dict] | None:
    if not isinstance(parsed_items, list) or len(parsed_items) != len(skeleton):
        return None
        
    validated = []
    for p_item, s_item in zip(parsed_items, skeleton):
        if not isinstance(p_item, dict):
            return None
            
        # Check order
        if int(p_item.get("order", 0)) != int(s_item["order"]):
            return None
            
        # Check duration
        if int(p_item.get("duration_minutes", 0)) != int(s_item["duration_minutes"]):
            return None
            
        # Check time
        if str(p_item.get("time", "")).strip() != str(s_item["time"]).strip():
            return None
            
        # Check place
        p_place = _normalize_name(str(p_item.get("place", "")))
        s_place = _normalize_name(str(s_item["place"]))
        if p_place != s_place:
            return None
            
        # Check estimated_cost_krw
        if int(p_item.get("estimated_cost_krw", 0)) != int(s_item.get("estimated_cost_krw", 0)):
            return None

        # Check coordinates (latitude and longitude)
        p_lat = p_item.get("latitude")
        s_lat = s_item["latitude"]
        p_lng = p_item.get("longitude")
        s_lng = s_item["longitude"]

        # Helper to compare float coords
        def coords_match(c1, c2):
            if c1 is None and c2 is None:
                return True
            if c1 is None or c2 is None:
                return False
            try:
                return abs(float(c1) - float(c2)) < 1e-5
            except (ValueError, TypeError):
                return False

        if not coords_match(p_lat, s_lat) or not coords_match(p_lng, s_lng):
            return None
            
        validated.append({
            "order": s_item["order"],
            "time": s_item["time"],
            "place": s_item["place"],
            "activity": str(p_item.get("activity", s_item["activity"])),
            "duration_minutes": s_item["duration_minutes"],
            "estimated_cost_krw": s_item["estimated_cost_krw"],
            "latitude": s_item["latitude"],
            "longitude": s_item["longitude"],
            "routing_source": s_item.get("routing_source"),
        })
        
    return validated


@traceable(name="Generate Itinerary With LLM", run_type="chain")
async def call_llm_for_itinerary(req: ItineraryGenerateRequest, skeleton: list[dict]) -> list[dict]:
    """Call the LLM to enrich the deterministic itinerary skeleton."""
    skeleton_json = json.dumps([
        {
            "order": item["order"],
            "time": item["time"],
            "place": item["place"],
            "activity": item["activity"],
            "duration_minutes": item["duration_minutes"],
            "estimated_cost_krw": item["estimated_cost_krw"],
            "latitude": item["latitude"],
            "longitude": item["longitude"],
        }
        for item in skeleton
    ], indent=2, ensure_ascii=False)

    user_prompt = (
        f"Location: {req.location}\n"
        f"Desired itinerary budget: {req.budget_krw if req.budget_krw else 'No limit'}\n"
        f"Available time: {req.available_hours} hours starting at {req.start_time}\n"
        f"Itinerary Skeleton (strictly preserve this structure):\n"
        f"{skeleton_json}\n\n"
        "You MUST keep every item in the skeleton exactly. Keep 'order', 'time', 'place', 'duration_minutes', 'estimated_cost_krw', 'latitude', and 'longitude' identical.\n"
        "You may only rewrite the activity field for destination stops.\n"
        "For travel legs such as 'Walk to X' or 'Taxi to X', keep the activity short and do not change duration."
    )

    try:
        raw_content = await _call_llm(
            messages=[
                {"role": "system", "content": _ITINERARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            model=LLM_MODEL_ID,
            temperature=0.3,
            provider="openrouter",
        )
        parsed_items = _parse_itinerary_items(raw_content)
        validated_items = _validate_llm_itinerary(parsed_items, skeleton)
        if validated_items:
            return validated_items
        else:
            print("⚠️ LLM itinerary validation failed. Falling back to skeleton.")
            return skeleton
    except Exception as exc:
        print(f"⚠️ Error during LLM itinerary generation: {exc}. Falling back to skeleton.")
        return skeleton


@router.post("/generate", response_model=ItineraryResponse)
@traceable(name="Itinerary Generate API", run_type="chain")
async def generate_itinerary(req: ItineraryGenerateRequest):
    """Generate an AI-powered itinerary and persist it."""
    # 1. Resolve selected hotspots
    service_dt = _current_service_datetime()
    _assert_public_transport_available(req.start_time)

    selected_hotspots = _resolve_hotspots(req.hotspots)
    if len(selected_hotspots) > 7:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "too_many_hotspots",
                "message": "Too many selected stops to optimize. Please select at most 7 hotspots."
            }
        )
    _raise_unavailable_hotspots(selected_hotspots)
    _raise_no_open_hotspots_at_start(selected_hotspots, req.start_time, service_dt)

    # 2. Build travel matrix and optimize route (with AI fill if enabled)
    ordered_hotspots, travel_matrix = await _fill_and_optimize_route(
        selected_hotspots,
        allow_ai_fill=req.allow_ai_fill,
        available_hours=req.available_hours,
        start_time=req.start_time,
        service_dt=service_dt,
    )

    # 3. Build deterministic skeleton
    skeleton = _build_deterministic_skeleton(ordered_hotspots, req.start_time, travel_matrix)
    
    # 4. Fallback if skeleton is empty
    if not skeleton:
        skeleton = [{
            "order": 1,
            "time": _format_minutes_as_time(_parse_time_to_minutes(req.start_time)),
            "place": req.location,
            "activity": "Explore the selected area at a relaxed pace.",
            "duration_minutes": 60,
            "estimated_cost_krw": 0,
            "latitude": None,
            "longitude": None,
            "routing_source": None,
        }]

    # 5. Reject schedules that place destinations outside known open hours.
    _raise_closed_destination_conflicts(_collect_closed_destination_conflicts(skeleton, service_dt))

    # 6. Check time budget
    available_minutes = req.available_hours * 60
    total_minutes = sum(item["duration_minutes"] for item in skeleton)
    if total_minutes > available_minutes:
        over_by_minutes = total_minutes - available_minutes
        stops_list = []
        breakdown_list = []
        travel_minutes = 0
        for item in skeleton:
            stops_list.append({
                "name": item["place"],
                "duration_minutes": item["duration_minutes"]
            })
            if _is_utility_item(item):
                travel_minutes += item["duration_minutes"]
                item_type = "taxi" if "taxi" in item["place"].lower() else "walk"
            else:
                item_type = "visit"
            breakdown_list.append({
                "type": item_type,
                "name": item["place"],
                "duration_minutes": item["duration_minutes"]
            })
        raise HTTPException(
            status_code=400,
            detail={
                "code": "itinerary_time_budget_exceeded",
                "message": "Not enough time for this itinerary.",
                "available_minutes": int(available_minutes),
                "required_minutes": int(total_minutes),
                "over_by_minutes": int(over_by_minutes),
                "stops": stops_list,
                "travel_minutes": int(travel_minutes),
                "travel_buffer_minutes": int(travel_minutes),
                "breakdown": breakdown_list
            }
        )

    # 7. Create or reuse session
    session_id = req.session_id or str(uuid.uuid4())
    existing = await get_session(session_id)
    if not existing:
        await create_session(session_id, location=req.location)

    # 8. Call LLM to enrich the skeleton
    enriched_items = await call_llm_for_itinerary(req, skeleton)

    # 9. Enrich items with Naver Map URLs where coordinates exist
    final_items = []
    for item in enriched_items:
        lat = item.get("latitude")
        lng = item.get("longitude")
        naver_url = None
        if lat and lng:
            urls = build_naver_urls(item.get("place", ""), lat, lng)
            naver_url = urls["naver_app_url"]
        final_items.append({**item, "naver_map_url": naver_url})
    response_items = _with_image_urls(final_items)

    # 10. Persist
    await save_itinerary_items(session_id, final_items)

    # 11. Build response
    total_cost = sum(item.get("estimated_cost_krw", 0) for item in final_items)
    session_data = await get_session(session_id)

    return ItineraryResponse(
        session_id=session_id,
        location=req.location,
        items=[ItineraryItem(**item) for item in response_items],
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

    response_items = _with_image_urls(items)
    total_cost = sum(item.get("estimated_cost_krw", 0) for item in response_items)
    return ItineraryResponse(
        session_id=session_id,
        location=session["location"],
        items=[ItineraryItem(**item) for item in response_items],
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
    response_items = _with_image_urls(items)
    total_cost = sum(item.get("estimated_cost_krw", 0) for item in response_items)
    return ItineraryResponse(
        session_id=session_id,
        location=session["location"],
        items=[ItineraryItem(**item) for item in response_items],
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
