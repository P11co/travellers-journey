"""
reverse_geocoding.py — Naver Reverse Geocoding API Service

Converts coordinates into a normalized Korean administrative area context.
Used as a fallback center label for local category discovery.
"""

from __future__ import annotations

import httpx

from server.config import NAVER_MAP_CLIENT_ID, NAVER_MAP_CLIENT_SECRET
from server.services.langsmith_tracing import traceable

REVERSE_GEOCODE_URL = "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc"


def _area_name(region: dict, key: str) -> str:
    area = region.get(key) or {}
    return str(area.get("name") or "").strip()


def _normalize_reverse_geocode_result(result: dict, latitude: float, longitude: float) -> dict | None:
    region = result.get("region") or {}
    city = _area_name(region, "area1")
    district = _area_name(region, "area2")
    dong = _area_name(region, "area3")
    ri = _area_name(region, "area4")

    locality_label = dong or district or city
    if not locality_label:
        return None

    return {
        "city": city or None,
        "district": district or None,
        "dong": dong or None,
        "ri": ri or None,
        "locality_label": locality_label,
        "display_label": " ".join(part for part in [city, district, dong] if part),
        "latitude": latitude,
        "longitude": longitude,
        "source": result.get("name") or result.get("code", {}).get("type") or "reverse_geocode",
    }


@traceable(name="Naver Reverse Geocode", run_type="tool")
async def reverse_geocode_area(
    latitude: float,
    longitude: float,
    orders: str = "admcode,legalcode",
) -> dict | None:
    """Return a normalized administrative area for the given WGS84 coordinate."""
    if not NAVER_MAP_CLIENT_ID or not NAVER_MAP_CLIENT_SECRET:
        print("⚠️ Naver Map API credentials not found, skipping reverse geocoding.")
        return None

    params = {
        "coords": f"{longitude},{latitude}",
        "orders": orders,
        "output": "json",
    }
    headers = {
        "X-NCP-APIGW-API-KEY-ID": NAVER_MAP_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": NAVER_MAP_CLIENT_SECRET,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(REVERSE_GEOCODE_URL, params=params, headers=headers)

        if resp.status_code != 200:
            print(f"⚠️ Naver Reverse Geocoding API failed ({resp.status_code}): {resp.text[:200]}")
            return None

        payload = resp.json()
        for result in payload.get("results", []) or []:
            normalized = _normalize_reverse_geocode_result(result, latitude, longitude)
            if normalized:
                return normalized
        return None
    except Exception as exc:
        print(f"⚠️ Reverse geocoding error: {exc}")
        return None
