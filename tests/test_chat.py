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
import json
from urllib.parse import quote


# ---------------------------------------------------------------------------
# Mock LLM helper
# ---------------------------------------------------------------------------
def _make_mock_openrouter_response(reply_text: str, status_code: int = 200) -> httpx.Response:
    """Build a fake httpx.Response that mimics the OpenRouter API."""
    return httpx.Response(
        status_code=status_code,
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


@pytest.mark.asyncio
async def test_call_llm_uses_openrouter_first(monkeypatch):
    """The shared LLM helper sends primary requests to OpenRouter."""
    from server.routers.chat import _call_llm

    monkeypatch.setattr("server.routers.chat.OPENROUTER_API_KEY", "test-openrouter-key")
    monkeypatch.setattr("server.routers.chat.NVIDIA_API_KEY", "test-nvidia-key")

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response("OpenRouter reply")
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        reply = await _call_llm(
            messages=[{"role": "user", "content": "Hello"}],
            model="google/gemma-4-31b-it",
        )

    assert reply == "OpenRouter reply"
    first_url = mock_instance.post.call_args_list[0].args[0]
    assert first_url == "https://openrouter.ai/api/v1/chat/completions"


@pytest.mark.asyncio
async def test_call_llm_falls_back_to_nvidia(monkeypatch):
    """If OpenRouter cannot complete, the shared LLM helper retries on NVIDIA."""
    from server.routers.chat import _call_llm

    monkeypatch.setattr("server.routers.chat.OPENROUTER_API_KEY", "test-openrouter-key")
    monkeypatch.setattr("server.routers.chat.NVIDIA_API_KEY", "test-nvidia-key")

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.side_effect = [
            _make_mock_openrouter_response("OpenRouter failure", status_code=502),
            _make_mock_openrouter_response("NVIDIA fallback reply"),
        ]
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        reply = await _call_llm(
            messages=[{"role": "user", "content": "Hello"}],
            model="google/gemma-4-31b-it",
        )

    assert reply == "NVIDIA fallback reply"
    urls = [call.args[0] for call in mock_instance.post.call_args_list]
    assert urls == [
        "https://openrouter.ai/api/v1/chat/completions",
        "https://integrate.api.nvidia.com/v1/chat/completions",
    ]


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


@pytest.mark.asyncio
async def test_chat_geocode_returns_naver_action_payload(client):
    """MAP_GEOCODE requests return a deterministic Naver handoff target."""
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="MAP_GEOCODE")), \
         patch("server.routers.chat.geocode_search", new=AsyncMock(return_value=[{
             "road_address": "1 Jong-ro, Jongno-gu, Seoul",
             "jibun_address": "",
             "english_address": "1 Jong-ro, Jongno-gu, Seoul",
             "building_name": "Kyobo Bookstore Gwanghwamun",
             "longitude": 126.9779,
             "latitude": 37.5702,
             "distance": 450,
         }])), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value="Kyobo Bookstore is south of the palace area.")):
        resp = await client.post("/chat", json={
            "message": "How do I get to Kyobo Bookstore?",
            "latitude": 37.57865,
            "longitude": 126.97711,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "OPEN_NAVER_MAP"
    assert data["action_payload"]["place_name"] == "Kyobo Bookstore Gwanghwamun"
    assert data["action_payload"]["latitude"] == 37.5702
    assert data["action_payload"]["longitude"] == 126.9779
    assert data["action_payload"]["naver_app_url"].startswith("nmap://place")


@pytest.mark.asyncio
async def test_chat_amenity_request_returns_naver_search_payload(client):
    """Amenity requests use a Naver search handoff instead of hallucinating a specific POI."""
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="MAP_GEOCODE")), \
         patch("server.routers.chat.geocode_search", new=AsyncMock()) as mock_geocode, \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value=(
             "There may be restrooms near the Donggung entrance according to palace context. "
             "I can also search Naver for bathrooms nearby."
         ))):
        resp = await client.post("/chat", json={
            "message": "Where is the closest bathroom?",
            "latitude": 37.57865,
            "longitude": 126.97711,
            "waypoint_id": "geunjeongjeon",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "OPEN_NAVER_MAP"
    assert data["action_payload"]["handoff_type"] == "search"
    assert data["action_payload"]["query"] == "bathroom"
    assert data["action_payload"]["naver_query"] == "화장실"
    assert data["action_payload"]["naver_app_url"].startswith("nmap://search")
    assert f"/search/{quote('화장실', safe='')}/" in data["action_payload"]["naver_web_url"]
    mock_geocode.assert_not_awaited()


@pytest.mark.asyncio
async def test_chat_subway_request_returns_naver_search_payload(client):
    """Transit requests use a nearby subway search handoff instead of the default palace target."""
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="MAP_GEOCODE")), \
         patch("server.routers.chat.geocode_search", new=AsyncMock()) as mock_geocode, \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value=(
             "I can open Naver Map to find the nearest subway station."
         ))):
        resp = await client.post("/chat", json={
            "message": "Which direction is to the subway? I want to go home.",
            "latitude": 37.57865,
            "longitude": 126.97711,
            "waypoint_id": "geunjeongjeon",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "OPEN_NAVER_MAP"
    assert data["action_payload"]["handoff_type"] == "search"
    assert data["action_payload"]["query"] == "subway station"
    assert data["action_payload"]["naver_query"] == "지하철역"
    assert data["action_payload"]["naver_app_url"].startswith("nmap://search")
    assert f"/search/{quote('지하철역', safe='')}/" in data["action_payload"]["naver_web_url"]
    mock_geocode.assert_not_awaited()


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


# ---------------------------------------------------------------------------
# POST /chat/stream — streams status, deltas, and final payload
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_stream_returns_ndjson_events(client):
    """Streaming chat emits incremental events and saves the final reply."""

    async def fake_prepare(_req, status_callback=None):
        if status_callback:
            await status_callback("Understanding request")
        return {
            "provider": "openrouter",
            "model": "test-model",
            "session_id": "stream-session",
            "waypoint": {"id": "geunjeongjeon", "name": "Geunjeongjeon"},
            "gps_context": "The user is at Geunjeongjeon.",
            "activity_context": "",
            "itinerary_context": "",
            "search_block": "",
            "geocode_block": "",
            "search_used": False,
            "intent": "MAP_STATIC",
            "full_system": "system prompt",
            "map_snapshot_included": False,
            "map_snapshot_artifact": None,
            "naver_action_payload": None,
            "messages": [
                {"role": "system", "content": "system prompt"},
                {"role": "user", "content": "Where now?"},
            ],
        }

    async def fake_stream_llm(*_args, **_kwargs):
        yield "Head "
        yield "to Sajeongjeon."

    with patch("server.routers.chat._prepare_chat_completion", new=fake_prepare), \
         patch("server.routers.chat._stream_llm", new=fake_stream_llm), \
         patch("server.routers.chat.save_chat_message", new=AsyncMock()) as mock_save:
        resp = await client.post("/chat/stream", json={"message": "Where now?"})

    assert resp.status_code == 200
    events = [json.loads(line) for line in resp.text.splitlines() if line.strip()]
    event_types = [event["type"] for event in events]
    assert event_types.count("status") >= 2
    assert event_types[-3:] == ["delta", "delta", "done"]
    meta_event = next(event for event in events if event["type"] == "meta")
    assert meta_event["session_id"] == "stream-session"
    assert meta_event["waypoint_id"] == "geunjeongjeon"
    assert events[-1]["reply"] == "Head to Sajeongjeon."
    assert mock_save.await_count == 2


# ---------------------------------------------------------------------------
# POST /chat — with activity logs injection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_with_activity_logs(client):
    """Chat correctly includes activity logs context in the system prompt."""
    session_id = "chat-activity-test"
    mock_reply = "I see you visited the ticket booth earlier today."

    # 1. Log simulated activity to populate database
    await client.post("/activity/log", json={
        "session_id": session_id,
        "latitude": 37.57724,
        "longitude": 126.97746,  # Ticket Booth
    })

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response(mock_reply)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        # 2. Call chat
        resp = await client.post("/chat", json={
            "message": "Where should I go now?",
            "session_id": session_id,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert "debug_trace" in data
    trace = data["debug_trace"]
    assert "activity_context" in trace
    assert "Ticket Booth" in trace["activity_context"]


# ---------------------------------------------------------------------------
# POST /chat — with map snapshot injection (Task 5)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_with_map_snapshot(client):
    """Chat endpoint fetches and includes map snapshot base64 image in LLM request when coords are supplied."""
    session_id = "chat-map-test"
    mock_reply = "Looking at the map, you are near Gwanghwamun gate."

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response(mock_reply)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        resp = await client.post("/chat", json={
            "message": "Tell me what is around me.",
            "session_id": session_id,
            "latitude": 37.57602,
            "longitude": 126.97685,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert "debug_trace" in data
    trace = data["debug_trace"]
    
    # Verify map snapshot was fetched and flagged as included
    assert trace["map_snapshot_included"] is True
    
    # Verify the message structure sent to the LLM has multimodal content array
    messages_sent = trace["messages_sent"]
    user_msg = messages_sent[-1]
    assert user_msg["role"] == "user"
    assert isinstance(user_msg["content"], list)
    assert user_msg["content"][0]["type"] == "text"
    assert user_msg["content"][0]["text"] == "Tell me what is around me."
    assert user_msg["content"][1]["type"] == "image_url"
    assert "data:image/png;base64," in user_msg["content"][1]["image_url"]["url"]


@pytest.mark.asyncio
async def test_chat_kyobo_bookstore_with_map(client):
    """
    Test asking if Kyobo Bookstore exists near Gwanghwamun Station Exit 9.
    Verify that when coordinates for Exit 9 are provided:
    1. A map snapshot is generated and sent as a multimodal image payload.
    2. When coordinates are omitted, no map snapshot is sent (text-only).
    """
    session_id = "kyobo-test-session"
    mock_reply = "Yes, Kyobo Bookstore is located right next to Gwanghwamun Station Exit 9."
    
    # --- Case A: Coordinates provided (Static map image sent) ---
    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response(mock_reply)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        resp = await client.post("/chat", json={
            "message": "Does Kyobo Bookstore (교보문고) exist near Gwanghwamun Station Exit 9?",
            "session_id": session_id,
            "latitude": 37.57017,
            "longitude": 126.97682,
        })
        
        assert resp.status_code == 200
        data = resp.json()
        assert data["reply"] == mock_reply
        assert data["debug_trace"]["map_snapshot_included"] is True
        
        # Verify the multimodal image payload was passed to the LLM Client request
        user_msg = data["debug_trace"]["messages_sent"][-1]
        assert isinstance(user_msg["content"], list)
        assert any(item["type"] == "image_url" for item in user_msg["content"])

    # --- Case B: No coordinates provided (No map image sent) ---
    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = _make_mock_openrouter_response("I cannot see a map of your location, so I'm not sure.")
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        resp_no_coords = await client.post("/chat", json={
            "message": "Does Kyobo Bookstore (교보문고) exist near Gwanghwamun Station Exit 9?",
            "session_id": session_id,
        })
        
        assert resp_no_coords.status_code == 200
        data_no_coords = resp_no_coords.json()
        assert data_no_coords["debug_trace"]["map_snapshot_included"] is False
        
        # Verify only a single text string was passed (not a multimodal image list)
        user_msg_no_coords = data_no_coords["debug_trace"]["messages_sent"][-1]
        assert isinstance(user_msg_no_coords["content"], str)
