"""
test_geocoding.py — Tests for the Naver Geocoding API service
"""

import pytest
from unittest.mock import patch, AsyncMock
import httpx

from server.services.geocoding import geocode_search, format_geocoding_for_prompt


# ---------------------------------------------------------------------------
# Mock response helpers
# ---------------------------------------------------------------------------
_MOCK_GEOCODE_RESPONSE = {
    "status": "OK",
    "meta": {"totalCount": 1, "page": 1, "count": 1},
    "addresses": [
        {
            "roadAddress": "서울특별시 종로구 종로 1",
            "jibunAddress": "서울특별시 종로구 종로1가 1",
            "englishAddress": "1, Jongno, Jongno-gu, Seoul, Republic of Korea",
            "addressElements": [
                {"types": ["SIDO"], "longName": "Seoul", "shortName": "Seoul", "code": ""},
                {"types": ["SIGUGUN"], "longName": "Jongno-gu", "shortName": "Jongno-gu", "code": ""},
                {"types": ["BUILDING_NAME"], "longName": "Kyobo Bookstore", "shortName": "Kyobo", "code": ""},
                {"types": ["POSTAL_CODE"], "longName": "03154", "shortName": "03154", "code": ""},
            ],
            "x": "126.98217",
            "y": "37.57017",
            "distance": 150.0,
        }
    ],
    "errorMessage": "",
}


# ---------------------------------------------------------------------------
# geocode_search tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_geocode_search_success():
    """geocode_search returns structured results on successful API response."""
    with patch("server.services.geocoding.NAVER_MAP_CLIENT_ID", "fake-id"), \
         patch("server.services.geocoding.NAVER_MAP_CLIENT_SECRET", "fake-secret"), \
         patch("httpx.AsyncClient.get") as mock_get:

        mock_get.return_value = httpx.Response(
            status_code=200,
            json=_MOCK_GEOCODE_RESPONSE,
        )

        results = await geocode_search("교보문고", center_lng=126.977, center_lat=37.570)

    assert len(results) == 1
    assert results[0]["building_name"] == "Kyobo Bookstore"
    assert results[0]["english_address"] == "1, Jongno, Jongno-gu, Seoul, Republic of Korea"
    assert results[0]["longitude"] == 126.98217
    assert results[0]["latitude"] == 37.57017
    assert results[0]["distance"] == 150.0


@pytest.mark.asyncio
async def test_geocode_search_no_credentials():
    """geocode_search returns empty list if API keys are missing."""
    with patch("server.services.geocoding.NAVER_MAP_CLIENT_ID", ""), \
         patch("server.services.geocoding.NAVER_MAP_CLIENT_SECRET", ""):

        results = await geocode_search("교보문고")

    assert results == []


@pytest.mark.asyncio
async def test_geocode_search_api_failure():
    """geocode_search returns empty list on API error."""
    with patch("server.services.geocoding.NAVER_MAP_CLIENT_ID", "fake-id"), \
         patch("server.services.geocoding.NAVER_MAP_CLIENT_SECRET", "fake-secret"), \
         patch("httpx.AsyncClient.get") as mock_get:

        mock_get.return_value = httpx.Response(
            status_code=401,
            content=b"Unauthorized",
        )

        results = await geocode_search("교보문고")

    assert results == []


@pytest.mark.asyncio
async def test_geocode_search_network_error():
    """geocode_search returns empty list on network exception."""
    with patch("server.services.geocoding.NAVER_MAP_CLIENT_ID", "fake-id"), \
         patch("server.services.geocoding.NAVER_MAP_CLIENT_SECRET", "fake-secret"), \
         patch("httpx.AsyncClient.get", side_effect=Exception("Timeout")):

        results = await geocode_search("교보문고")

    assert results == []


# ---------------------------------------------------------------------------
# format_geocoding_for_prompt tests
# ---------------------------------------------------------------------------

def test_format_geocoding_empty():
    """Empty results return a 'No results found' message."""
    output = format_geocoding_for_prompt([], "교보문고")
    assert "No results found" in output
    assert "교보문고" in output


def test_format_geocoding_with_results():
    """Formatted output includes address, building name, and coordinates."""
    results = [
        {
            "road_address": "서울특별시 종로구 종로 1",
            "jibun_address": "서울특별시 종로구 종로1가 1",
            "english_address": "1, Jongno, Jongno-gu, Seoul, Republic of Korea",
            "building_name": "Kyobo Bookstore",
            "longitude": 126.98217,
            "latitude": 37.57017,
            "distance": 150.0,
        }
    ]
    output = format_geocoding_for_prompt(results, "교보문고")
    assert "GEOCODING SEARCH RESULTS" in output
    assert "Kyobo Bookstore" in output
    assert "126.982170" in output
    assert "150m" in output
