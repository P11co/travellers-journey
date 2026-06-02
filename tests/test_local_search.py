import httpx
import pytest
from unittest.mock import AsyncMock, patch

from server.services import local_search
from server.services.local_search import (
    normalize_local_search_item,
    rank_local_results_by_distance,
    search_naver_local,
    strip_html,
)


def _local_response(items):
    return httpx.Response(status_code=200, json={"items": items})


def test_strip_html_removes_naver_highlights():
    assert strip_html("<b>서촌</b> 카페") == "서촌 카페"


def test_normalize_local_search_item_keeps_wgs84_coordinates():
    item = {
        "title": "<b>해목 서촌점</b>",
        "category": "일식당",
        "roadAddress": "서울특별시 종로구 자하문로 26-1",
        "address": "서울특별시 종로구 통의동 1",
        "mapx": "126.9702",
        "mapy": "37.5792",
        "link": "https://example.com",
    }

    result = normalize_local_search_item(item, rank=1, source_query="서촌 식당")

    assert result["name"] == "해목 서촌점"
    assert result["category"] == "일식당"
    assert result["road_address"] == "서울특별시 종로구 자하문로 26-1"
    assert result["longitude"] == 126.9702
    assert result["latitude"] == 37.5792
    assert result["source_query"] == "서촌 식당"


def test_normalize_local_search_item_ignores_non_wgs84_coordinates():
    result = normalize_local_search_item(
        {"title": "Old coordinate place", "mapx": "310000", "mapy": "550000"},
        rank=1,
        source_query="서촌 식당",
    )

    assert result["longitude"] is None
    assert result["latitude"] is None


def test_rank_local_results_by_distance_sorts_coordinate_results_first():
    results = [
        {"name": "far", "rank": 1, "latitude": 37.60, "longitude": 127.00},
        {"name": "near", "rank": 2, "latitude": 37.5797, "longitude": 126.9771},
        {"name": "unknown", "rank": 3, "latitude": None, "longitude": None},
    ]

    ranked = rank_local_results_by_distance(results, 37.5796, 126.977)

    assert [item["name"] for item in ranked] == ["near", "far", "unknown"]
    assert ranked[0]["distance_meters"] < ranked[1]["distance_meters"]
    assert ranked[2]["distance_meters"] is None


@pytest.mark.asyncio
async def test_search_naver_local_success(monkeypatch):
    monkeypatch.setattr(local_search, "NAVER_LOCAL_CLIENT_ID", "local-id")
    monkeypatch.setattr(local_search, "NAVER_LOCAL_CLIENT_SECRET", "local-secret")

    with patch("server.services.local_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.get.return_value = _local_response([
            {
                "title": "<b>near</b>",
                "category": "카페",
                "roadAddress": "near road",
                "mapx": "126.9771",
                "mapy": "37.5797",
            },
            {
                "title": "far",
                "category": "카페",
                "roadAddress": "far road",
                "mapx": "127.0000",
                "mapy": "37.6000",
            },
        ])
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        results = await search_naver_local(
            "서촌 카페",
            center_latitude=37.5796,
            center_longitude=126.977,
        )

    assert [item["name"] for item in results] == ["near", "far"]
    assert results[0]["distance_meters"] < results[1]["distance_meters"]
    assert mock.get.await_args.kwargs["params"]["query"] == "서촌 카페"
    assert mock.get.await_args.kwargs["headers"]["X-Naver-Client-Id"] == "local-id"


@pytest.mark.asyncio
async def test_search_naver_local_missing_credentials(monkeypatch):
    monkeypatch.setattr(local_search, "NAVER_LOCAL_CLIENT_ID", "")
    monkeypatch.setattr(local_search, "NAVER_LOCAL_CLIENT_SECRET", "")

    assert await search_naver_local("서촌 카페") == []


@pytest.mark.asyncio
async def test_search_naver_local_api_failure(monkeypatch):
    monkeypatch.setattr(local_search, "NAVER_LOCAL_CLIENT_ID", "local-id")
    monkeypatch.setattr(local_search, "NAVER_LOCAL_CLIENT_SECRET", "local-secret")

    with patch("server.services.local_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.get.return_value = httpx.Response(status_code=429, text="rate limited")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        assert await search_naver_local("서촌 카페") == []
