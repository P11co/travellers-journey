"""
local_search.py — Naver Local Search API Service

Executes text-based local discovery queries and normalizes returned places.
Distance ranking is applied locally when a WGS84 center and result coordinates
are available.
"""

from __future__ import annotations

import math
import re

import httpx

from server.config import NAVER_LOCAL_CLIENT_ID, NAVER_LOCAL_CLIENT_SECRET
from server.services.langsmith_tracing import traceable

LOCAL_SEARCH_URL = "https://openapi.naver.com/v1/search/local.json"


def strip_html(value: str | None) -> str:
    """Remove simple HTML tags used by Naver search highlights."""
    return re.sub(r"<[^>]+>", "", value or "").strip()


def _parse_float(value) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def _valid_wgs84(latitude: float | None, longitude: float | None) -> bool:
    return (
        latitude is not None
        and longitude is not None
        and 30 <= latitude <= 45
        and 120 <= longitude <= 135
    )


def _extract_wgs84(item: dict) -> tuple[float | None, float | None]:
    longitude = _parse_float(item.get("longitude") or item.get("x") or item.get("mapx"))
    latitude = _parse_float(item.get("latitude") or item.get("y") or item.get("mapy"))
    if _valid_wgs84(latitude, longitude):
        return latitude, longitude
    return None, None


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371e3
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def normalize_local_search_item(item: dict, rank: int, source_query: str) -> dict:
    latitude, longitude = _extract_wgs84(item)
    return {
        "rank": rank,
        "name": strip_html(item.get("title")),
        "category": strip_html(item.get("category")),
        "description": strip_html(item.get("description")),
        "telephone": strip_html(item.get("telephone")),
        "address": strip_html(item.get("address")),
        "road_address": strip_html(item.get("roadAddress")),
        "link": item.get("link") or "",
        "latitude": latitude,
        "longitude": longitude,
        "distance_meters": None,
        "source_query": source_query,
    }


def rank_local_results_by_distance(
    results: list[dict],
    center_latitude: float | None,
    center_longitude: float | None,
) -> list[dict]:
    if center_latitude is None or center_longitude is None:
        return results

    ranked = []
    for result in results:
        next_result = dict(result)
        next_result["distance_meters"] = None
        if result.get("latitude") is not None and result.get("longitude") is not None:
            next_result["distance_meters"] = round(
                haversine_meters(
                    center_latitude,
                    center_longitude,
                    result["latitude"],
                    result["longitude"],
                )
            )
        ranked.append(next_result)

    return sorted(
        ranked,
        key=lambda item: (
            item["distance_meters"] is None,
            item["distance_meters"] if item["distance_meters"] is not None else float("inf"),
            item["rank"],
        ),
    )


@traceable(name="Naver Local Search", run_type="tool")
async def search_naver_local(
    query: str,
    display: int = 5,
    start: int = 1,
    sort: str = "random",
    center_latitude: float | None = None,
    center_longitude: float | None = None,
) -> list[dict]:
    """Run Naver Local Search and return normalized, optionally distance-ranked places."""
    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return []
    if not NAVER_LOCAL_CLIENT_ID or not NAVER_LOCAL_CLIENT_SECRET:
        print("⚠️ Naver Local Search credentials not found, skipping local search.")
        return []

    params = {
        "query": cleaned_query,
        "display": max(1, min(int(display or 5), 10)),
        "start": max(1, int(start or 1)),
        "sort": sort if sort in {"random", "comment"} else "random",
    }
    headers = {
        "X-Naver-Client-Id": NAVER_LOCAL_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_LOCAL_CLIENT_SECRET,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(LOCAL_SEARCH_URL, params=params, headers=headers)

        if resp.status_code != 200:
            print(f"⚠️ Naver Local Search API failed ({resp.status_code}): {resp.text[:200]}")
            return []

        items = resp.json().get("items", []) or []
        normalized = [
            normalize_local_search_item(item, rank=index + start, source_query=cleaned_query)
            for index, item in enumerate(items)
        ]
        return rank_local_results_by_distance(normalized, center_latitude, center_longitude)
    except Exception as exc:
        print(f"⚠️ Naver Local Search error: {exc}")
        return []
