import httpx
import pytest
from unittest.mock import AsyncMock, patch

from server.services import reverse_geocoding
from server.services.reverse_geocoding import reverse_geocode_area


def _reverse_response(results):
    return httpx.Response(status_code=200, json={"status": {"code": 0}, "results": results})


@pytest.mark.asyncio
async def test_reverse_geocode_area_returns_normalized_dong(monkeypatch):
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_ID", "map-id")
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_SECRET", "map-secret")

    with patch("server.services.reverse_geocoding.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.get.return_value = _reverse_response([
            {
                "name": "admcode",
                "region": {
                    "area1": {"name": "서울특별시"},
                    "area2": {"name": "종로구"},
                    "area3": {"name": "세종로"},
                    "area4": {"name": ""},
                },
            }
        ])
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        result = await reverse_geocode_area(latitude=37.5796, longitude=126.977)

    assert result["city"] == "서울특별시"
    assert result["district"] == "종로구"
    assert result["dong"] == "세종로"
    assert result["locality_label"] == "세종로"
    assert result["display_label"] == "서울특별시 종로구 세종로"
    assert result["latitude"] == 37.5796
    assert result["longitude"] == 126.977


@pytest.mark.asyncio
async def test_reverse_geocode_area_uses_district_when_dong_missing(monkeypatch):
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_ID", "map-id")
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_SECRET", "map-secret")

    with patch("server.services.reverse_geocoding.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.get.return_value = _reverse_response([
            {
                "name": "legalcode",
                "region": {
                    "area1": {"name": "서울특별시"},
                    "area2": {"name": "종로구"},
                    "area3": {"name": ""},
                },
            }
        ])
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        result = await reverse_geocode_area(latitude=37.5796, longitude=126.977)

    assert result["locality_label"] == "종로구"


@pytest.mark.asyncio
async def test_reverse_geocode_area_missing_credentials(monkeypatch):
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_ID", "")
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_SECRET", "")

    assert await reverse_geocode_area(latitude=37.5796, longitude=126.977) is None


@pytest.mark.asyncio
async def test_reverse_geocode_area_api_failure(monkeypatch):
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_ID", "map-id")
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_SECRET", "map-secret")

    with patch("server.services.reverse_geocoding.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.get.return_value = httpx.Response(status_code=500, text="server error")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        assert await reverse_geocode_area(latitude=37.5796, longitude=126.977) is None


@pytest.mark.asyncio
async def test_reverse_geocode_area_network_error(monkeypatch):
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_ID", "map-id")
    monkeypatch.setattr(reverse_geocoding, "NAVER_MAP_CLIENT_SECRET", "map-secret")

    with patch("server.services.reverse_geocoding.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.get.side_effect = httpx.RequestError("boom")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        assert await reverse_geocode_area(latitude=37.5796, longitude=126.977) is None
