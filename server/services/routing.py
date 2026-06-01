"""
routing.py — SeoulWalk Routing & Directions Service

Interacts with the Naver Directions 5 API to compute distances and durations.
Provides fallback math when Naver is offline/unconfigured.
"""

from __future__ import annotations
import math
import httpx
from server.config import NAVER_MAP_CLIENT_ID, NAVER_MAP_CLIENT_SECRET
from server.services.langsmith_tracing import traceable

DIRECTIONS_URL = "https://maps.apigw.ntruss.com/map-direction/v1/driving"


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth in meters."""
    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def round_up_to_5(minutes: float) -> int:
    """Round up minutes to the nearest multiple of 5, minimum 5."""
    return max(5, int(math.ceil(minutes / 5.0) * 5))


_DIRECTIONS_CACHE: dict[tuple[float, float, float, float], tuple[float, float]] = {}


@traceable(name="Naver Directions API", run_type="tool")
async def fetch_driving_route(
    start_lng: float, start_lat: float, goal_lng: float, goal_lat: float
) -> tuple[float, float] | None:
    """
    Fetch distance in meters and driving duration in minutes from Naver Directions API.
    
    Returns:
        (distance_meters, driving_duration_minutes) or None on failure/missing credentials.
    """
    cache_key = (start_lng, start_lat, goal_lng, goal_lat)
    if cache_key in _DIRECTIONS_CACHE:
        return _DIRECTIONS_CACHE[cache_key]

    if not NAVER_MAP_CLIENT_ID or not NAVER_MAP_CLIENT_SECRET:
        return None

    headers = {
        "X-NCP-APIGW-API-KEY-ID": NAVER_MAP_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": NAVER_MAP_CLIENT_SECRET,
        "Accept": "application/json",
    }
    params = {
        "start": f"{start_lng},{start_lat}",
        "goal": f"{goal_lng},{goal_lat}",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(DIRECTIONS_URL, params=params, headers=headers)
        if resp.status_code != 200:
            print(f"⚠️ Naver Directions API failed ({resp.status_code}): {resp.text[:200]}")
            return None
        data = resp.json()
        route = data.get("route", {})
        traoptimal = route.get("traoptimal", [])
        if not traoptimal:
            return None
        summary = traoptimal[0].get("summary", {})
        distance = float(summary.get("distance", 0))
        # duration is in milliseconds
        duration_ms = float(summary.get("duration", 0))
        duration_minutes = duration_ms / 60000.0
        
        result = (distance, duration_minutes)
        _DIRECTIONS_CACHE[cache_key] = result
        return result
    except Exception as e:
        print(f"⚠️ Naver Directions API error: {e}")
        return None


async def get_travel_leg(
    start_lat: float, start_lng: float, goal_lat: float, goal_lng: float
) -> dict:
    """
    Compute travel leg mode and duration between two coordinates.
    
    Returns a dict with:
        "mode": "walk" | "taxi"
        "duration_minutes": int (rounded up to nearest 5 mins)
        "distance_meters": int
        "routing_source": "naver" | "fallback"
    """
    # 1. Try to fetch driving route from Naver
    route_data = await fetch_driving_route(start_lng, start_lat, goal_lng, goal_lat)
    if route_data is not None:
        distance, driving_duration = route_data
        routing_source = "naver"
    else:
        # Fallback using Haversine distance with scale factor 1.3
        distance = haversine_distance(start_lat, start_lng, goal_lat, goal_lng) * 1.3
        # Assumes driving speed of 20 km/h (333.3 meters/minute)
        driving_duration = distance / 333.3
        routing_source = "fallback"

    # 2. Apply Walk vs Taxi decision logic
    # Walking speed is 67 meters per minute (~4 km/h)
    walking_time = distance / 67.0
    if walking_time <= 25:
        return {
            "mode": "walk",
            "duration_minutes": round_up_to_5(walking_time),
            "distance_meters": int(distance),
            "routing_source": routing_source,
        }
    else:
        return {
            "mode": "taxi",
            "duration_minutes": round_up_to_5(driving_duration + 5),
            "distance_meters": int(distance),
            "routing_source": routing_source,
        }
