"""
test_chat.py — Tests for the Chat / RAG endpoint

Tests:
  1. POST /chat with a basic message (mocked LLM)
  2. POST /chat with waypoint_id for spatial context
  3. POST /chat with lat/lng for auto-waypoint detection
  4. Session creation on first chat
  5. Health check endpoint
"""

import pytest
from unittest.mock import patch, AsyncMock
import httpx


# ---------------------------------------------------------------------------
# Mock LLM helper
# ---------------------------------------------------------------------------
def _make_mock_openrouter_response(reply_text: str) -> httpx.Response:
    """Build a fake httpx.Response that mimics the OpenRouter API."""
    return httpx.Response(
        status_code=200,
        json={
            "choices": [
                {"message": {"content": reply_text}}
            ]
        },
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health(client):
    """GET /health returns status ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


# ---------------------------------------------------------------------------
# POST /chat — basic message
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_basic(client):
    """Basic chat returns a reply and creates a session."""
    mock_reply = "Welcome to Gyeongbokgung Palace! The ticket booth is ahead."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response(mock_reply)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        resp = await client.post("/chat", json={
            "message": "Where do I buy tickets?",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["reply"] == mock_reply
    assert "session_id" in data


# ---------------------------------------------------------------------------
# POST /chat — with waypoint_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_with_waypoint(client):
    """Chat with a waypoint_id includes spatial context."""
    mock_reply = "You are at the Main Gate. The ticket booth is to your right."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response(mock_reply)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        resp = await client.post("/chat", json={
            "message": "What can I see from here?",
            "waypoint_id": "main_gate",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["waypoint_id"] == "main_gate"


# ---------------------------------------------------------------------------
# POST /chat — with lat/lng (auto-detection)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_with_coordinates(client):
    """Chat with lat/lng auto-detects the nearest waypoint."""
    mock_reply = "The Throne Hall is straight ahead."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response(mock_reply)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        resp = await client.post("/chat", json={
            "message": "Tell me about this building",
            # These coordinates are at the Geunjeongjeon Throne Hall
            "latitude": 37.57865,
            "longitude": 126.97711,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["waypoint_id"] == "geunjeongjeon"


# ---------------------------------------------------------------------------
# POST /chat — detects Naver Map action
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_action_detection(client):
    """Chat that mentions 'Naver Map' triggers the OPEN_NAVER_MAP action."""
    mock_reply = "I can show you the way on Naver Map if you'd like."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response(mock_reply)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        resp = await client.post("/chat", json={
            "message": "How do I get to the museum?",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "OPEN_NAVER_MAP"


# ---------------------------------------------------------------------------
# POST /chat — reuses existing session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_reuse_session(client):
    """Passing an existing session_id reuses it."""
    mock_reply = "Sure, let me help."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response(mock_reply)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        # First message creates session
        resp1 = await client.post("/chat", json={"message": "Hello"})
        sid = resp1.json()["session_id"]

        # Second message reuses it
        resp2 = await client.post("/chat", json={
            "message": "Thanks",
            "session_id": sid,
        })

    assert resp2.json()["session_id"] == sid
