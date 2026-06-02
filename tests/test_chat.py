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


def test_sanitize_assistant_reply_removes_tool_call_markup():
    """Pseudo tool calls are backend control leakage, not user-facing prose."""
    from server.routers.chat import _sanitize_assistant_reply

    reply = _sanitize_assistant_reply(
        '<tool_call>\n{"name":"naver_map_search","arguments":{"query":"카페 near Gyeongbokgung Palace"}}\n</tool_call>',
        has_action=True,
    )

    assert reply == "I can open that search in Naver Map for you."


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


@pytest.mark.asyncio
async def test_get_live_environment_fetches_fresh_data_each_call():
    """Live environment context is rebuilt per request instead of using stale cache."""
    from server.routers.chat import _get_live_environment

    weather_first = httpx.Response(
        status_code=200,
        json={
            "current": {"temperature_2m": 21, "weather_code": 0},
            "daily": {"uv_index_max": [5]},
        },
    )
    aqi_first = httpx.Response(status_code=200, json={"current": {"us_aqi": 42}})
    weather_second = httpx.Response(
        status_code=200,
        json={
            "current": {"temperature_2m": 22, "weather_code": 61},
            "daily": {"uv_index_max": [6]},
        },
    )
    aqi_second = httpx.Response(status_code=200, json={"current": {"us_aqi": 43}})

    with patch("server.routers.chat.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.get.side_effect = [
            weather_first,
            aqi_first,
            weather_second,
            aqi_second,
        ]
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_instance

        first = await _get_live_environment()
        second = await _get_live_environment()

    assert mock_instance.get.call_count == 4
    assert "- Weather: 21°C, Clear" in first
    assert "- UV Index: 5" in first
    assert "- Air Quality (AQI): 42" in first
    assert "- Weather: 22°C, Rain" in second
    assert "- UV Index: 6" in second
    assert "- Air Quality (AQI): 43" in second


def test_system_prompt_requires_plain_natural_language():
    """The assistant contract stays compatible with chat display and TTS."""
    from server.routers.chat import _SYSTEM_PROMPT

    assert "plain natural language" in _SYSTEM_PROMPT
    assert "Do not use markdown formatting of any kind" in _SYSTEM_PROMPT
    assert "no bullets" in _SYSTEM_PROMPT


def test_quick_replies_prompt_is_conservative():
    """The quick-reply contract favors no buttons over bad buttons."""
    from server.routers.chat import _QUICK_REPLIES_SYSTEM_PROMPT

    assert 'return {"options":[]}' in _QUICK_REPLIES_SYSTEM_PROMPT
    assert "Only create options when the assistant explicitly presents 2 or 3 choices" in _QUICK_REPLIES_SYSTEM_PROMPT
    assert "Do not invent choices" in _QUICK_REPLIES_SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_quick_replies_generates_options(client, monkeypatch):
    """POST /chat/quick-replies returns validated labels from strict JSON."""
    monkeypatch.setattr("server.routers.chat.OPENROUTER_API_KEY", "test-openrouter-key")
    llm = AsyncMock(return_value='{"options":[{"label":"Suggest a plan for tomorrow"},{"label":"Nearby night spot"}]}')

    with patch("server.routers.chat._call_llm", new=llm):
        resp = await client.post("/chat/quick-replies", json={
            "assistant_message": (
                "Would you like me to suggest a plan for tomorrow or guide you to a nearby night spot?"
            ),
            "session_id": "quick-replies-test",
        })

    assert resp.status_code == 200
    assert resp.json() == {
        "options": [
            {"label": "Suggest a plan for tomorrow"},
            {"label": "Nearby night spot"},
        ]
    }
    sent_messages = llm.await_args.kwargs["messages"]
    assert "suggest a plan for tomorrow" in sent_messages[-1]["content"]


@pytest.mark.asyncio
async def test_quick_replies_allows_empty_options(client, monkeypatch):
    """No buttons is a valid response when the assistant did not ask a choice question."""
    monkeypatch.setattr("server.routers.chat.OPENROUTER_API_KEY", "test-openrouter-key")

    with patch("server.routers.chat._call_llm", new=AsyncMock(return_value='{"options":[]}')):
        resp = await client.post("/chat/quick-replies", json={
            "assistant_message": "Gyeongbokgung is closed for the evening, but Insadong is nearby.",
        })

    assert resp.status_code == 200
    assert resp.json() == {"options": []}


@pytest.mark.asyncio
async def test_quick_replies_rejects_non_json_model_output(client, monkeypatch):
    """Malformed model output fails loudly for backend debugging."""
    monkeypatch.setattr("server.routers.chat.OPENROUTER_API_KEY", "test-openrouter-key")

    with patch("server.routers.chat._call_llm", new=AsyncMock(return_value='No quick replies.')):
        resp = await client.post("/chat/quick-replies", json={
            "assistant_message": "Anything else I can help with?",
        })

    assert resp.status_code == 422
    assert resp.json()["detail"]["message"] == "Quick-reply model did not return valid JSON."


@pytest.mark.asyncio
async def test_quick_replies_rejects_wrong_json_shape(client, monkeypatch):
    """JSON that does not match the declared options schema is a 422."""
    monkeypatch.setattr("server.routers.chat.OPENROUTER_API_KEY", "test-openrouter-key")

    with patch("server.routers.chat._call_llm", new=AsyncMock(return_value='{"buttons":["Nearby night spot"]}')):
        resp = await client.post("/chat/quick-replies", json={
            "assistant_message": "Would you like a plan for tomorrow or a nearby night spot?",
        })

    assert resp.status_code == 422
    assert resp.json()["detail"]["message"] == "Quick-reply model returned JSON that does not match the required schema."


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
async def test_chat_naver_mention_without_payload_does_not_trigger_action(client):
    """A prose-only Naver mention must not create an app-opening action."""
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
    assert data["action"] is None
    assert data["action_payload"] is None


@pytest.mark.asyncio
async def test_chat_next_stop_request_returns_itinerary_naver_payload(client):
    """Route-progress questions use saved itinerary coordinates for Naver handoff."""
    from server.database import create_session, save_itinerary_items

    session_id = "chat-itinerary-naver-test"
    await create_session(session_id, location="Gwanghwamun")
    await save_itinerary_items(session_id, [
        {
            "order": 1,
            "time": "08:15 PM",
            "place": "Gyeongbokgung Palace",
            "activity": "Start at the palace grounds.",
            "duration_minutes": 30,
            "estimated_cost_krw": 0,
            "latitude": 37.57865,
            "longitude": 126.97711,
        },
        {
            "order": 2,
            "time": "08:45 PM",
            "place": "Naksan Park",
            "activity": "Walk the ridge trail and city viewpoint.",
            "duration_minutes": 45,
            "estimated_cost_krw": 0,
            "latitude": 37.58083,
            "longitude": 127.00753,
        },
    ])

    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="RAG")), \
         patch("server.routers.chat.search_rag", return_value="PALACE_KNOWLEDGE: context"), \
         patch("server.routers.chat.geocode_search", new=AsyncMock()) as mock_geocode, \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value=(
             "You're on the grounds of Gyeongbokgung Palace. According to your saved itinerary, "
             "the next stop is Naksan Park. I can open Naver Map to give you exact directions."
         ))):
        resp = await client.post("/chat", json={
            "message": "Hey where are we, and where to go",
            "session_id": session_id,
            "latitude": 37.57865,
            "longitude": 126.97711,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "OPEN_NAVER_MAP"
    assert data["action_payload"]["handoff_type"] == "itinerary_place"
    assert data["action_payload"]["place_name"] == "Naksan Park"
    assert data["action_payload"]["latitude"] == 37.58083
    assert data["action_payload"]["longitude"] == 127.00753
    assert data["action_payload"]["naver_app_url"].startswith("nmap://place")
    mock_geocode.assert_not_awaited()


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
    assert data["action_payload"]["handoff_type"] == "search"
    assert data["action_payload"]["query"] == "Kyobo Bookstore Gwanghwamun"
    assert data["action_payload"]["naver_query"] == "Kyobo Bookstore Gwanghwamun"
    assert data["action_payload"]["latitude"] == 37.5702
    assert data["action_payload"]["longitude"] == 126.9779
    assert data["action_payload"]["naver_app_url"].startswith("nmap://search")
    assert "query=Kyobo%20Bookstore%20Gwanghwamun" in data["action_payload"]["naver_app_url"]
    assert "/search/Kyobo%20Bookstore%20Gwanghwamun/" in data["action_payload"]["naver_web_url"]


@pytest.mark.asyncio
async def test_chat_geocode_uses_classifier_naver_search_query(client):
    """MAP_GEOCODE handoff uses the classifier's exact Naver search keyword."""
    geocode_mock = AsyncMock(return_value=[{
        "road_address": "1 Jong-ro, Jongno-gu, Seoul",
        "jibun_address": "",
        "english_address": "1 Jong-ro, Jongno-gu, Seoul",
        "building_name": "Kyobo Bookstore Gwanghwamun",
        "longitude": 126.9779,
        "latitude": 37.5702,
        "distance": 450,
    }])
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value={
            "intent": "MAP_GEOCODE",
            "naver_search_query": "교보문고 광화문",
            "display_query": "Kyobo Bookstore Gwanghwamun",
         })), \
         patch("server.routers.chat.geocode_search", new=geocode_mock), \
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
    geocode_mock.assert_awaited_once()
    assert geocode_mock.await_args.kwargs["query"] == "교보문고 광화문"
    assert data["action_payload"]["place_name"] == "Kyobo Bookstore Gwanghwamun"
    assert data["action_payload"]["query"] == "교보문고 광화문"
    assert data["action_payload"]["naver_query"] == "교보문고 광화문"
    assert "query=%EA%B5%90%EB%B3%B4%EB%AC%B8%EA%B3%A0%20%EA%B4%91%ED%99%94%EB%AC%B8" in data["action_payload"]["naver_app_url"]


@pytest.mark.asyncio
async def test_chat_contextual_place_request_uses_attached_waypoint_for_search(client):
    """Requests like 'this place' use the attached waypoint as the Naver search key."""
    geocode_mock = AsyncMock(return_value=[])
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value={
            "intent": "MAP_GEOCODE",
            "naver_search_query": "Gyeongbokgung Palace",
            "display_query": "Gyeongbokgung Palace",
         })), \
         patch("server.routers.chat.geocode_search", new=geocode_mock), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value="I can open Naver Map for this place.")):
        resp = await client.post("/chat", json={
            "message": "How do I get to this place?",
            "latitude": 37.57724,
            "longitude": 126.97746,
            "waypoint_id": "ticket_booth",
        })

    assert resp.status_code == 200
    data = resp.json()
    geocode_mock.assert_awaited_once()
    assert geocode_mock.await_args.kwargs["query"] == "경복궁 매표소"
    assert data["action_payload"]["place_name"] == "Ticket Booth"
    assert data["action_payload"]["query"] == "경복궁 매표소"
    assert data["action_payload"]["naver_query"] == "경복궁 매표소"
    assert "query=%EA%B2%BD%EB%B3%B5%EA%B6%81%20%EB%A7%A4%ED%91%9C%EC%86%8C" in data["action_payload"]["naver_app_url"]


@pytest.mark.asyncio
async def test_chat_contextual_place_request_gets_payload_even_without_map_intent(client):
    """Attached waypoint handoff works even when final wording alone triggers the Naver button."""
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="RAG")), \
         patch("server.routers.chat.geocode_search", new=AsyncMock()) as mock_geocode, \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat.search_rag", return_value="PALACE_KNOWLEDGE: Hyangwonjeong context"), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value=(
             "You are already at Hyangwonjeong Pavilion. I can open Naver Map if you need precise navigation."
         ))):
        resp = await client.post("/chat", json={
            "message": "How do I get here",
            "latitude": 37.57962,
            "longitude": 126.97598,
            "waypoint_id": "hyangwonjeong",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "OPEN_NAVER_MAP"
    assert data["action_payload"]["query"] == "향원정 경복궁"
    assert "query=%ED%96%A5%EC%9B%90%EC%A0%95%20%EA%B2%BD%EB%B3%B5%EA%B6%81" in data["action_payload"]["naver_app_url"]
    mock_geocode.assert_not_awaited()


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


@pytest.mark.asyncio
async def test_chat_followup_cafe_uses_seochon_local_discovery(client):
    """Short quick-reply follow-ups preserve the area from the last assistant reply."""
    from server.database import create_session, save_chat_message

    session_id = "seochon-local-discovery-test"
    await create_session(session_id, location="Gwanghwamun")
    await save_chat_message(
        session_id,
        "assistant",
        "Seochon is west of Gwanghwamun Gate. Would you like a cafe, restaurant, or gallery there?",
    )

    geocode_mock = AsyncMock(return_value=[{
        "road_address": "Seochon, Seoul",
        "building_name": "",
        "longitude": 126.9702,
        "latitude": 37.5792,
        "distance": 0,
    }])
    local_mock = AsyncMock(return_value=[{
        "rank": 1,
        "name": "Cafe Seochon",
        "category": "카페",
        "road_address": "서울특별시 종로구 자하문로",
        "latitude": 37.5793,
        "longitude": 126.9703,
        "distance_meters": 25,
        "source_query": "서촌 카페",
    }])

    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value={
            "intent": "MAP_GEOCODE",
            "naver_search_query": None,
            "display_query": "cafes",
            "category_query": "카페",
            "target_area": None,
            "local_category_search": False,
         })), \
         patch("server.routers.chat.geocode_search", new=geocode_mock), \
         patch("server.routers.chat.search_naver_local", new=local_mock), \
         patch("server.routers.chat.reverse_geocode_area", new=AsyncMock()) as mock_reverse, \
         patch("server.routers.chat.search_rag", return_value="PALACE_KNOWLEDGE: context"), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value="Let me search for cafes in Seochon for you.")):
        resp = await client.post("/chat", json={
            "message": "Find a cafe",
            "session_id": session_id,
            "latitude": 37.57865,
            "longitude": 126.97711,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "OPEN_NAVER_MAP"
    assert data["action_payload"]["handoff_type"] == "local_discovery_search"
    assert data["action_payload"]["naver_query"] == "서촌 카페"
    assert data["action_payload"]["search_area_label"] == "Seochon"
    assert data["action_payload"]["search_center_latitude"] == 37.5792
    assert data["action_payload"]["local_search_result_count"] == 1
    assert "query=%EC%84%9C%EC%B4%8C%20%EC%B9%B4%ED%8E%98" in data["action_payload"]["naver_app_url"]
    geocode_mock.assert_awaited_once()
    assert geocode_mock.await_args.kwargs["query"] == "서촌"
    local_mock.assert_awaited_once()
    assert local_mock.await_args.args[0] == "서촌 카페"
    mock_reverse.assert_not_awaited()


@pytest.mark.asyncio
async def test_chat_plain_cafe_still_uses_generic_amenity_fallback(client):
    """No-area cafe requests keep the simple amenity behavior."""
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="MAP_GEOCODE")), \
         patch("server.routers.chat.geocode_search", new=AsyncMock()) as mock_geocode, \
         patch("server.routers.chat.search_naver_local", new=AsyncMock()) as mock_local, \
         patch("server.routers.chat.reverse_geocode_area", new=AsyncMock()) as mock_reverse, \
         patch("server.routers.chat.search_rag", return_value="PALACE_KNOWLEDGE: context"), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value="I can search Naver for cafes nearby.")):
        resp = await client.post("/chat", json={
            "message": "Find a cafe",
            "latitude": 37.57865,
            "longitude": 126.97711,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action_payload"]["handoff_type"] == "search"
    assert data["action_payload"]["query"] == "cafe"
    assert data["action_payload"]["naver_query"] == "카페"
    mock_geocode.assert_not_awaited()
    mock_local.assert_not_awaited()
    mock_reverse.assert_not_awaited()


@pytest.mark.asyncio
async def test_chat_restaurants_near_gyeongbokgung_uses_local_search_center(client):
    """Area category searches geocode the area, then run local search against that center."""
    geocode_mock = AsyncMock(return_value=[{
        "road_address": "Gyeongbokgung, Seoul",
        "building_name": "Gyeongbokgung Palace",
        "longitude": 126.9770,
        "latitude": 37.5796,
        "distance": 0,
    }])
    local_mock = AsyncMock(return_value=[
        {
            "rank": 1,
            "name": "Nearby Restaurant",
            "category": "식당",
            "latitude": 37.5798,
            "longitude": 126.9772,
            "distance_meters": 30,
            "source_query": "경복궁 식당",
        },
    ])

    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value={
            "intent": "MAP_GEOCODE",
            "naver_search_query": "경복궁 식당",
            "display_query": "restaurants near Gyeongbokgung",
            "category_query": "식당",
            "target_area": "경복궁",
            "local_category_search": True,
         })), \
         patch("server.routers.chat.geocode_search", new=geocode_mock), \
         patch("server.routers.chat.search_naver_local", new=local_mock), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value="Let me search for restaurants near Gyeongbokgung.")):
        resp = await client.post("/chat", json={
            "message": "Find restaurants near Gyeongbokgung",
            "latitude": 37.57865,
            "longitude": 126.97711,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action_payload"]["handoff_type"] == "local_discovery_search"
    assert data["action_payload"]["naver_query"] == "경복궁 식당"
    assert data["action_payload"]["search_center_latitude"] == 37.5796
    assert data["action_payload"]["search_center_longitude"] == 126.9770
    geocode_mock.assert_awaited_once()
    assert geocode_mock.await_args.kwargs["query"] == "경복궁"
    local_mock.assert_awaited_once()
    assert local_mock.await_args.kwargs["center_latitude"] == 37.5796
    assert local_mock.await_args.kwargs["center_longitude"] == 126.9770


@pytest.mark.asyncio
async def test_chat_reverse_geocode_failure_falls_back_to_generic_amenity(client):
    """Local discovery failure does not break chat or remove the generic amenity fallback."""
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value={
            "intent": "MAP_GEOCODE",
            "naver_search_query": None,
            "display_query": "cafes nearby",
            "category_query": "카페",
            "target_area": None,
            "local_category_search": True,
         })), \
         patch("server.routers.chat.geocode_search", new=AsyncMock()) as mock_geocode, \
         patch("server.routers.chat.reverse_geocode_area", new=AsyncMock(return_value=None)) as mock_reverse, \
         patch("server.routers.chat.search_naver_local", new=AsyncMock()) as mock_local, \
         patch("server.routers.chat.search_rag", return_value="PALACE_KNOWLEDGE: context"), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)), \
         patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value="I can search Naver for cafes nearby.")):
        resp = await client.post("/chat", json={
            "message": "Find a cafe",
            "latitude": 37.57865,
            "longitude": 126.97711,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["action_payload"]["handoff_type"] == "search"
    assert data["action_payload"]["naver_query"] == "카페"
    mock_geocode.assert_not_awaited()
    mock_reverse.assert_awaited_once()
    mock_local.assert_not_awaited()


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
    """MAP_STATIC chat fetches and includes a map snapshot image when coords are supplied."""
    session_id = "chat-map-test"
    mock_reply = "Looking at the map, you are near Gwanghwamun gate."

    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="MAP_STATIC")), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value="ZmFrZS1wbmc=")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value=mock_reply)):
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
    assert "The center marker is not a destination" in trace["full_prompt"]
    
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
@pytest.mark.parametrize("intent", ["RAG", "WEB_SEARCH"])
async def test_non_map_intents_do_not_attach_snapshot_with_coords(client, monkeypatch, intent):
    """RAG and WEB_SEARCH keep coordinates as text context without sending a map image."""
    monkeypatch.setattr("server.routers.chat.LLM_MODEL_ID", "deepseek/deepseek-v4-flash")
    monkeypatch.setattr("server.routers.chat.VISION_MODEL_ID", "xiaomi/mimo-v2.5")

    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value=intent)), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock()) as mock_snapshot, \
         patch("server.routers.chat.search_rag", return_value="PALACE_KNOWLEDGE: history"), \
         patch("server.routers.chat.search_with_fallback", new=AsyncMock(return_value=[])), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value="Text-only answer.")) as mock_call:
        resp = await client.post("/chat", json={
            "message": "What should I know here?",
            "session_id": f"coords-{intent.lower()}-test",
            "latitude": 37.57602,
            "longitude": 126.97685,
        })

    assert resp.status_code == 200
    mock_snapshot.assert_not_awaited()
    assert mock_call.await_args.kwargs["model"] == "deepseek/deepseek-v4-flash"

    messages = mock_call.await_args.kwargs["messages"]
    user_msg = messages[-1]
    assert isinstance(user_msg["content"], str)


@pytest.mark.asyncio
async def test_map_snapshot_uses_vision_model_for_final_answer(client, monkeypatch):
    """Map-image chat should classify with the text model, then answer with the vision model."""
    monkeypatch.setattr("server.routers.chat.LLM_MODEL_ID", "deepseek/deepseek-v4-flash")
    monkeypatch.setattr("server.routers.chat.VISION_MODEL_ID", "xiaomi/mimo-v2.5")

    with patch(
        "server.routers.chat.classify_intent",
        new=AsyncMock(return_value={
            "intent": "MAP_STATIC",
            "naver_search_query": None,
            "display_query": None,
        }),
    ) as mock_classify, \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value="ZmFrZS1wbmc=")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value="Use the path ahead.")) as mock_call:
        resp = await client.post("/chat", json={
            "message": "Where should I go from here?",
            "session_id": "map-static-mimo-test",
            "latitude": 37.57602,
            "longitude": 126.97685,
        })

    assert resp.status_code == 200
    assert mock_classify.await_args.kwargs["model"] == "deepseek/deepseek-v4-flash"
    assert mock_call.await_args.kwargs["model"] == "xiaomi/mimo-v2.5"

    messages = mock_call.await_args.kwargs["messages"]
    user_msg = messages[-1]
    assert isinstance(user_msg["content"], list)
    assert user_msg["content"][1]["type"] == "image_url"


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
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="MAP_GEOCODE")), \
         patch("server.routers.chat.geocode_search", new=AsyncMock(return_value=[])), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value="ZmFrZS1wbmc=")), \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value=mock_reply)):
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
    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="MAP_GEOCODE")), \
         patch("server.routers.chat.geocode_search", new=AsyncMock(return_value=[])), \
         patch("server.routers.chat.get_map_snapshot", new=AsyncMock()) as mock_snapshot, \
         patch("server.routers.chat._call_llm", new=AsyncMock(return_value=(
             "I cannot see a map of your location, so I'm not sure."
         ))):
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
        mock_snapshot.assert_not_awaited()
