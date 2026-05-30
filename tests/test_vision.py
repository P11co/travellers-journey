"""
test_vision.py — Tests for the POST /chat/vision endpoint

Tests:
  1. Basic vision query returns reply and session_id
  2. Vision with waypoint_id returns spatial context
  3. Vision with lat/lng auto-detects waypoint
  4. Missing image_base64 returns 422
  5. LLM error returns 502
"""

import base64
import pytest
from unittest.mock import AsyncMock, patch
import httpx


def _make_openrouter_response(text: str) -> httpx.Response:
    return httpx.Response(
        status_code=200,
        json={"choices": [{"message": {"content": text}}]},
    )


def _make_openrouter_error(status: int = 500) -> httpx.Response:
    return httpx.Response(status_code=status, text="Internal Server Error")


# A minimal 1x1 pixel white JPEG in base64 (valid image, tiny size)
_TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U"
    "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN"
    "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA//EABQQ"
    "AAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAA"
    "AAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k="
)


@pytest.fixture(autouse=True)
def _vision_api_key(monkeypatch):
    """Vision tests mock the HTTP client, so only a sentinel key is needed."""
    monkeypatch.setattr("server.routers.chat.OPENROUTER_API_KEY", "test-openrouter-key")


# ---------------------------------------------------------------------------
# POST /chat/vision — basic
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_vision_basic(client):
    """Vision endpoint returns reply and session_id."""
    mock_reply = "This is Gwanghwamun, the main gate of Gyeongbokgung Palace, built in 1395."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response(mock_reply)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        resp = await client.post("/chat/vision", json={
            "message": "What is this gate?",
            "image_base64": _TINY_JPEG_B64,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["reply"] == mock_reply
    assert "session_id" in data


@pytest.mark.asyncio
async def test_vision_with_waypoint(client):
    """Vision with waypoint_id attaches spatial context."""
    mock_reply = "This is the throne hall, Geunjeongjeon. The name means industrious governance."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response(mock_reply)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        resp = await client.post("/chat/vision", json={
            "message": "What is the big hall I'm looking at?",
            "image_base64": _TINY_JPEG_B64,
            "waypoint_id": "geunjeongjeon",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["waypoint_id"] == "geunjeongjeon"


@pytest.mark.asyncio
async def test_vision_with_coordinates(client):
    """Vision with lat/lng auto-detects waypoint from coordinates."""
    mock_reply = "This is the Gyeonghoeru Pavilion, used for royal banquets."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response(mock_reply)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        resp = await client.post("/chat/vision", json={
            "message": "What is this pavilion?",
            "image_base64": _TINY_JPEG_B64,
            # Gyeonghoeru coordinates from waypoints.json
            "latitude": 37.57962,
            "longitude": 126.97598,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["waypoint_id"] == "gyeonghoeru"


@pytest.mark.asyncio
async def test_vision_identified_subject_extracted(client):
    """Short first sentence is extracted as identified_subject."""
    mock_reply = "Geunjeongjeon Throne Hall. This is the main ceremonial hall built in 1395."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response(mock_reply)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        resp = await client.post("/chat/vision", json={
            "image_base64": _TINY_JPEG_B64,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["identified_subject"] == "Geunjeongjeon Throne Hall"


@pytest.mark.asyncio
async def test_vision_missing_image_returns_422(client):
    """Missing image_base64 field returns 422 Unprocessable Entity."""
    resp = await client.post("/chat/vision", json={
        "message": "What is this?",
        # no image_base64
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_vision_llm_error_returns_502(client):
    """LLM API error returns 502 Bad Gateway."""
    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_error(500)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        resp = await client.post("/chat/vision", json={
            "image_base64": _TINY_JPEG_B64,
        })

    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_vision_reuses_session(client):
    """Vision endpoint reuses an existing session_id."""
    mock_reply = "This appears to be the ticket booth area."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response(mock_reply)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        # First call creates session
        r1 = await client.post("/chat/vision", json={"image_base64": _TINY_JPEG_B64})
        sid = r1.json()["session_id"]

        # Second call reuses it
        r2 = await client.post("/chat/vision", json={
            "image_base64": _TINY_JPEG_B64,
            "session_id": sid,
        })

    assert r2.json()["session_id"] == sid
