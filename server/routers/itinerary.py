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
import uuid
import httpx
from fastapi import APIRouter, HTTPException

from server.config import OPENROUTER_API_KEY, LLM_MODEL_ID, OPENROUTER_BASE_URL, WAYPOINTS
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

router = APIRouter(prefix="/itinerary", tags=["Itinerary"])


# ---------------------------------------------------------------------------
# LLM prompt for itinerary generation
# ---------------------------------------------------------------------------
_ITINERARY_SYSTEM_PROMPT = """\
You are SeoulWalk Itinerary Planner. Given a tourist's constraints, generate \
a structured day-plan as a JSON array.

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
- Respect the user's budget and available time.
- Keep activities realistic for the Gwanghwamun / Gyeongbokgung area.
- If you know the GPS coordinates of a place, include them. Otherwise set to null.
"""


def _build_user_prompt(req: ItineraryGenerateRequest) -> str:
    budget_text = f"{req.budget_krw:,} KRW" if req.budget_krw else "No budget constraint"
    hotspot_list = ", ".join(req.hotspots)
    waypoint_info = ""
    if WAYPOINTS:
        wp_names = [wp["name"] for wp in WAYPOINTS]
        waypoint_info = (
            f"\n\nKnown waypoints with exact GPS coordinates:\n"
            + "\n".join(
                f'- {wp["name"]}: lat={wp["coordinates"]["latitude"]}, lng={wp["coordinates"]["longitude"]}'
                for wp in WAYPOINTS
            )
        )

    return (
        f"Location: {req.location}\n"
        f"Selected hotspots: {hotspot_list}\n"
        f"Budget: {budget_text}\n"
        f"Available time: {req.available_hours} hours starting at {req.start_time}\n"
        f"{waypoint_info}"
    )


async def call_llm_for_itinerary(req: ItineraryGenerateRequest) -> list[dict]:
    """Call OpenRouter LLM to generate the itinerary JSON."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OpenRouter API key")

    user_prompt = _build_user_prompt(req)

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            OPENROUTER_BASE_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL_ID,
                "messages": [
                    {"role": "system", "content": _ITINERARY_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.4,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouter returned {resp.status_code}: {resp.text[:300]}",
        )

    data = resp.json()
    raw_content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

    # Parse the JSON array from the LLM response
    try:
        # Strip markdown code fences if the model wraps output in ```json ... ```
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]  # remove first line
            cleaned = cleaned.rsplit("```", 1)[0]  # remove closing fence
        items = json.loads(cleaned)
        if not isinstance(items, list):
            raise ValueError("Expected a JSON array")
        return items
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"LLM returned unparseable itinerary: {e}. Raw: {raw_content[:500]}",
        )


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
