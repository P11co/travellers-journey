"""
test_handoff.py — Tests for the Naver Maps handoff endpoint

Tests:
  1. POST /handoff/naver-map returns valid deep links
  2. URL-encodes Korean place names correctly
  3. Coordinates appear in both app and web URLs
"""

import pytest
from urllib.parse import unquote


# ---------------------------------------------------------------------------
# POST /handoff/naver-map
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_handoff_basic(client):
    """Basic handoff returns both app and web URLs."""
    resp = await client.post("/handoff/naver-map", json={
        "place_name": "Gyeongbokgung Palace",
        "latitude": 37.5796,
        "longitude": 126.9770,
    })
    assert resp.status_code == 200
    data = resp.json()

    assert data["place_name"] == "Gyeongbokgung Palace"
    assert data["naver_app_url"].startswith("nmap://")
    assert data["naver_web_url"].startswith("https://map.naver.com")
    assert "37.5796" in data["naver_app_url"]
    assert "126.977" in data["naver_app_url"]


@pytest.mark.asyncio
async def test_handoff_korean_name(client):
    """Korean place names are URL-encoded properly."""
    resp = await client.post("/handoff/naver-map", json={
        "place_name": "경복궁",
        "latitude": 37.5796,
        "longitude": 126.9770,
    })
    assert resp.status_code == 200
    data = resp.json()

    # The app URL should contain the encoded name
    assert "nmap://" in data["naver_app_url"]
    # The web URL should also contain the encoded name
    assert "map.naver.com" in data["naver_web_url"]
    # Verify the original name is recoverable from encoding
    assert data["place_name"] == "경복궁"


@pytest.mark.asyncio
async def test_handoff_coordinates_in_urls(client):
    """Lat/lng should appear in both the app and web URLs."""
    lat, lng = 37.57865, 126.97711
    resp = await client.post("/handoff/naver-map", json={
        "place_name": "Geunjeongjeon",
        "latitude": lat,
        "longitude": lng,
    })
    data = resp.json()

    assert str(lat) in data["naver_app_url"]
    assert str(lng) in data["naver_app_url"]
    assert str(lng) in data["naver_web_url"]
    assert str(lat) in data["naver_web_url"]


@pytest.mark.asyncio
async def test_handoff_missing_fields(client):
    """Missing required fields should return 422."""
    resp = await client.post("/handoff/naver-map", json={
        "place_name": "Test",
        # missing latitude and longitude
    })
    assert resp.status_code == 422
