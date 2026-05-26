"""
activity.py — Activity logging router for spatiotemporal trace
"""
from __future__ import annotations
import uuid
import math
from fastapi import APIRouter, HTTPException

from server.models import (
    ActivityLogRequest,
    ActivityLogResponse,
    ActivitySummaryResponse,
)
from server.database import (
    get_session,
    create_session,
    save_activity_log,
    get_activity_logs,
    get_latest_activity_log,
)
from server.config import WAYPOINTS
from server.services.map_snapshot import get_map_snapshot

router = APIRouter(prefix="/activity", tags=["Activity"])


def _find_nearest_waypoint(lat: float, lng: float) -> dict | None:
    """Find the nearest waypoint within its geofence radius using haversine formula."""
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371000.0  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = (
            math.sin(dphi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
        )
        return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    for wp in WAYPOINTS:
        dist = _haversine(
            lat,
            lng,
            wp["coordinates"]["latitude"],
            wp["coordinates"]["longitude"],
        )
        if dist <= wp["radius"]:
            return wp
    return None


@router.post("/log", response_model=ActivityLogResponse)
async def log_activity(req: ActivityLogRequest):
    """Record a GPS ping from the frontend (called every ~5 min or on waypoint change)."""
    # Ensure session exists
    if not await get_session(req.session_id):
        await create_session(req.session_id, location="Gwanghwamun")

    # Match to nearest waypoint
    wp = _find_nearest_waypoint(req.latitude, req.longitude)

    # Optimize query costs: Reuse previous snapshot if user is stationary (moved < ~11 meters)
    map_snapshot_b64 = None
    latest_log = await get_latest_activity_log(req.session_id)
    if latest_log:
        lat_diff = abs(req.latitude - latest_log["latitude"])
        lng_diff = abs(req.longitude - latest_log["longitude"])
        if lat_diff < 0.0001 and lng_diff < 0.0001 and latest_log["map_snapshot_b64"]:
            map_snapshot_b64 = latest_log["map_snapshot_b64"]
            print("🔄 Reusing previous map snapshot (user is stationary).")

    if not map_snapshot_b64:
        map_snapshot_b64 = await get_map_snapshot(req.latitude, req.longitude)

    await save_activity_log(
        session_id=req.session_id,
        latitude=req.latitude,
        longitude=req.longitude,
        matched_waypoint_id=wp["id"] if wp else None,
        map_snapshot_b64=map_snapshot_b64,
    )

    return ActivityLogResponse(
        session_id=req.session_id,
        matched_waypoint_id=wp["id"] if wp else None,
        matched_waypoint_name=wp["name"] if wp else None,
    )


@router.get("/{session_id}/summary", response_model=ActivitySummaryResponse)
async def get_activity_summary(session_id: str):
    """Build a human-readable summary of the user's journey."""
    logs = await get_activity_logs(session_id)
    if not logs:
        return ActivitySummaryResponse(
            session_id=session_id,
            total_logs=0,
            visited_waypoints=[],
            summary_text="No activity recorded yet.",
            logs=[],
        )

    # Build visited waypoints list (deduplicated, in order)
    visited = []
    for log in logs:
        wp_id = log.get("matched_waypoint_id")
        if wp_id and (not visited or visited[-1] != wp_id):
            visited.append(wp_id)

    # Build waypoint name lookup
    wp_names = {wp["id"]: wp["name"] for wp in WAYPOINTS}
    visited_names = [wp_names.get(wp_id, wp_id) for wp_id in visited]

    # Build natural language summary
    parts = []
    current_wp = None
    arrival_time = None

    for log in logs:
        wp_id = log.get("matched_waypoint_id")
        ts = log["timestamp"]

        if wp_id != current_wp:
            if current_wp:
                name = wp_names.get(current_wp, current_wp)
                parts.append(f"Visited {name} (arrived {arrival_time})")
            current_wp = wp_id
            arrival_time = ts

    # Add the current/last location
    if current_wp and arrival_time:
        name = wp_names.get(current_wp, current_wp)
        parts.append(f"Currently at {name} (since {arrival_time})")
    elif logs:
        last = logs[-1]
        parts.append(
            f"Currently at ({last['latitude']:.4f}, {last['longitude']:.4f}) at {last['timestamp']}"
        )

    summary_text = "User journey: " + " → ".join(parts) if parts else "No movement tracked."

    return ActivitySummaryResponse(
        session_id=session_id,
        total_logs=len(logs),
        visited_waypoints=visited_names,
        summary_text=summary_text,
        logs=logs,
    )
