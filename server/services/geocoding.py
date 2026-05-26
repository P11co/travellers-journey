"""
geocoding.py — Naver Geocoding API Service

Converts a place name or address query into structured location data
(coordinates, road address, building name) using the Naver Maps Geocoding API.

Used when the intent classifier routes a query to MAP_GEOCODE — e.g.,
"Where is Kyobo Bookstore?" or "Is there a public restroom nearby?"
"""

from __future__ import annotations

import httpx

from server.config import NAVER_MAP_CLIENT_ID, NAVER_MAP_CLIENT_SECRET

GEOCODE_URL = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"


async def geocode_search(
    query: str,
    center_lng: float | None = None,
    center_lat: float | None = None,
    count: int = 3,
    language: str = "eng",
) -> list[dict]:
    """
    Search for addresses/places matching the query string via Naver Geocoding API.

    Args:
        query: Place name or address to search (e.g., "교보문고 광화문", "public restroom Jongno")
        center_lng: Optional longitude to bias results toward (proximity sort)
        center_lat: Optional latitude to bias results toward (proximity sort)
        count: Max number of results to return (1-100, default 3)
        language: Response language — "kor" or "eng" (default "eng")

    Returns:
        List of dicts with keys: road_address, jibun_address, english_address,
        building_name, longitude, latitude, distance
        Returns empty list on failure or missing credentials.
    """
    if not NAVER_MAP_CLIENT_ID or not NAVER_MAP_CLIENT_SECRET:
        print("⚠️ Naver Map API credentials not found, skipping geocoding.")
        return []

    params: dict = {
        "query": query,
        "count": count,
        "language": language,
    }

    # Bias results by proximity to the user's current location
    if center_lng is not None and center_lat is not None:
        params["coordinate"] = f"{center_lng},{center_lat}"

    headers = {
        "X-NCP-APIGW-API-KEY-ID": NAVER_MAP_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": NAVER_MAP_CLIENT_SECRET,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(GEOCODE_URL, params=params, headers=headers)

        if resp.status_code != 200:
            print(f"⚠️ Naver Geocoding API failed ({resp.status_code}): {resp.text[:200]}")
            return []

        data = resp.json()
        addresses = data.get("addresses", [])

        results = []
        for addr in addresses:
            # Extract building name from addressElements
            building_name = ""
            for elem in addr.get("addressElements", []):
                if "BUILDING_NAME" in elem.get("types", []):
                    building_name = elem.get("longName", "")
                    break

            results.append({
                "road_address": addr.get("roadAddress", ""),
                "jibun_address": addr.get("jibunAddress", ""),
                "english_address": addr.get("englishAddress", ""),
                "building_name": building_name,
                "longitude": float(addr.get("x", 0)),
                "latitude": float(addr.get("y", 0)),
                "distance": addr.get("distance", 0.0),
            })

        return results

    except Exception as e:
        print(f"⚠️ Geocoding error: {e}")
        return []


def format_geocoding_for_prompt(results: list[dict], query: str) -> str:
    """
    Format geocoding results into a context block for the LLM system prompt.
    """
    if not results:
        return f'\nGEOCODING SEARCH for "{query}": No results found.'

    lines = [f'GEOCODING SEARCH RESULTS for "{query}":']
    for i, r in enumerate(results, 1):
        name_part = f' ({r["building_name"]})' if r["building_name"] else ""
        lines.append(
            f"[{i}] {r['road_address']}{name_part}\n"
            f"    English: {r['english_address']}\n"
            f"    Coordinates: {r['latitude']:.6f}, {r['longitude']:.6f}"
            + (f"  (Distance: {r['distance']:.0f}m from you)" if r["distance"] else "")
        )

    return "\n".join(lines)
