"""
test_web_search.py — Tests for the web search service and search-augmented chat

Tests:
  1. LLM classifier: time-sensitive queries return True
  2. LLM classifier: historical queries return False
  3. LLM classifier fails gracefully (no API key)
  4. Tavily search returns structured results
  5. format_search_results_for_prompt produces WEB_SEARCH_RESULTS block
  6. POST /chat with mocked search returns web_search_used=True
  7. POST /chat for historical query skips search (web_search_used=False)
"""

import pytest
from unittest.mock import AsyncMock, patch
import httpx

from server.services.web_search import format_search_results_for_prompt


# ---------------------------------------------------------------------------
# Helper — fake Tavily response
# ---------------------------------------------------------------------------
_MOCK_TAVILY_RESULTS = [
    {
        "title": "Gyeongbokgung Palace Admission & Hours",
        "url": "https://royal.khs.go.kr/eng/",
        "content": "Gyeongbokgung Palace is open Tuesday through Sunday, 9 AM to 6 PM. "
                   "Adult admission is 3,000 KRW. Closed on Tuesdays.",
        "score": 0.92,
    },
    {
        "title": "Visit Korea — Gyeongbokgung",
        "url": "https://english.visitkorea.or.kr/",
        "content": "The palace holds the daily Changing of the Guard ceremony at 10 AM and 2 PM.",
        "score": 0.85,
    },
]

def _make_openrouter_response(text: str) -> httpx.Response:
    return httpx.Response(
        status_code=200,
        json={"choices": [{"message": {"content": text}}]},
    )

def _make_tavily_response(results: list) -> httpx.Response:
    return httpx.Response(
        status_code=200,
        json={"results": results},
    )


@pytest.fixture(autouse=True)
def _llm_api_keys(monkeypatch):
    monkeypatch.setattr("server.services.web_search.OPENROUTER_API_KEY", "test-openrouter-key")
    monkeypatch.setattr("server.services.web_search.NVIDIA_API_KEY", "test-nvidia-key")


# ---------------------------------------------------------------------------
# Unit tests for format_search_results_for_prompt
# ---------------------------------------------------------------------------

def test_format_search_results_empty():
    """Empty results return empty string."""
    assert format_search_results_for_prompt([]) == ""


def test_format_search_results_includes_domain():
    """Formatted block includes domain citation and WEB_SEARCH_RESULTS header."""
    block = format_search_results_for_prompt(_MOCK_TAVILY_RESULTS)
    assert "WEB_SEARCH_RESULTS" in block
    assert "royal.khs.go.kr" in block
    assert "3,000 KRW" in block
    assert "[1]" in block
    assert "[2]" in block


# ---------------------------------------------------------------------------
# LLM classifier tests — mock the OpenRouter call
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_classifier_web_search():
    """A query about hours/prices should classify as WEB_SEARCH."""
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response("WEB_SEARCH")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import classify_intent
        result = await classify_intent("What time does the palace close today?")

    assert result == "WEB_SEARCH"


@pytest.mark.asyncio
async def test_classifier_rag():
    """A historical question should classify as RAG."""
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response("RAG")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import classify_intent
        result = await classify_intent("Who built Gyeongbokgung Palace?")

    assert result == "RAG"


@pytest.mark.asyncio
async def test_classifier_map_static():
    """A surroundings question should classify as MAP_STATIC."""
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response("MAP_STATIC")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import classify_intent
        result = await classify_intent("What buildings are around me?")

    assert result == "MAP_STATIC"


@pytest.mark.asyncio
async def test_classifier_map_geocode():
    """A specific place search should classify as MAP_GEOCODE."""
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response("MAP_GEOCODE")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import classify_intent
        result = await classify_intent("Where is Kyobo Bookstore?")

    assert result == "MAP_GEOCODE"


@pytest.mark.asyncio
async def test_classifier_returns_naver_search_query_for_route():
    """Structured classifier output includes a Naver search keyword when requested."""
    classifier_reply = (
        '{"intent":"MAP_GEOCODE","naver_search_query":"교보문고 광화문",'
        '"display_query":"Kyobo Bookstore Gwanghwamun"}'
    )
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response(classifier_reply)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import classify_intent
        result = await classify_intent(
            "How do I get to Kyobo Bookstore?",
            return_route=True,
        )

    assert result == {
        "intent": "MAP_GEOCODE",
        "naver_search_query": "교보문고 광화문",
        "display_query": "Kyobo Bookstore Gwanghwamun",
        "category_query": None,
        "target_area": None,
        "local_category_search": False,
    }


@pytest.mark.asyncio
async def test_classifier_returns_local_category_route_fields():
    """Structured classifier output can preserve area-aware category search intent."""
    classifier_reply = (
        '{"intent":"MAP_GEOCODE","naver_search_query":"서촌 카페",'
        '"display_query":"cafes in Seochon","category_query":"카페",'
        '"target_area":"서촌","local_category_search":true}'
    )
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_openrouter_response(classifier_reply)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import classify_intent
        result = await classify_intent(
            "Find a cafe",
            last_ai_message="Seochon is nearby and has cafes.",
            return_route=True,
        )

    assert result == {
        "intent": "MAP_GEOCODE",
        "naver_search_query": "서촌 카페",
        "display_query": "cafes in Seochon",
        "category_query": "카페",
        "target_area": "서촌",
        "local_category_search": True,
    }


@pytest.mark.asyncio
async def test_classifier_fails_gracefully():
    """If the API call fails, classifier returns RAG (safe default)."""
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.side_effect = Exception("Network error")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import classify_intent
        result = await classify_intent("What time does it close?")

    assert result == "RAG"


@pytest.mark.asyncio
async def test_classifier_falls_back_to_nvidia():
    """Classifier tries OpenRouter first, then NVIDIA if OpenRouter errors."""
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.side_effect = [
            httpx.Response(status_code=502, json={"error": "bad gateway"}),
            _make_openrouter_response("MAP_STATIC"),
        ]
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import classify_intent
        result = await classify_intent("What buildings are around me?")

    assert result == "MAP_STATIC"
    urls = [call.args[0] for call in mock.post.call_args_list]
    assert urls == [
        "https://openrouter.ai/api/v1/chat/completions",
        "https://integrate.api.nvidia.com/v1/chat/completions",
    ]


@pytest.mark.asyncio
async def test_needs_web_search_backward_compat():
    """needs_web_search wrapper returns True only for WEB_SEARCH intent."""
    with patch("server.services.web_search.classify_intent", new=AsyncMock(return_value="WEB_SEARCH")):
        from server.services.web_search import needs_web_search
        assert await needs_web_search("What time?") is True

    with patch("server.services.web_search.classify_intent", new=AsyncMock(return_value="RAG")):
        from server.services.web_search import needs_web_search
        assert await needs_web_search("Who built it?") is False


# ---------------------------------------------------------------------------
# Tavily search test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tavily_search_returns_results():
    """Tavily search returns structured result dicts."""
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.return_value = _make_tavily_response(_MOCK_TAVILY_RESULTS)
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import tavily_search
        results = await tavily_search("Gyeongbokgung opening hours")

    assert len(results) == 2
    assert results[0]["title"] == "Gyeongbokgung Palace Admission & Hours"
    assert "score" in results[0]
    assert "content" in results[0]


@pytest.mark.asyncio
async def test_tavily_search_fails_gracefully():
    """Tavily search returns empty list on error."""
    with patch("server.services.web_search.httpx.AsyncClient") as MockClient:
        mock = AsyncMock()
        mock.post.side_effect = Exception("Timeout")
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock

        from server.services.web_search import tavily_search
        results = await tavily_search("What time does it close?")

    assert results == []


# ---------------------------------------------------------------------------
# Integration: POST /chat with search augmentation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_search_augmented(client):
    """Time-sensitive query triggers web search; response includes web_search_used=True."""
    llm_reply = "The palace closes at 6 PM today (royal.khs.go.kr)."

    with patch("server.routers.chat.classify_intent", new=AsyncMock(return_value="WEB_SEARCH")), \
         patch("server.routers.chat.search_with_fallback", new=AsyncMock(return_value=_MOCK_TAVILY_RESULTS)), \
         patch("server.routers.chat.httpx.AsyncClient") as MockChatClient:

        chat_llm_mock = AsyncMock()
        chat_llm_mock.post.return_value = _make_openrouter_response(llm_reply)
        chat_llm_mock.__aenter__ = AsyncMock(return_value=chat_llm_mock)
        chat_llm_mock.__aexit__ = AsyncMock(return_value=False)
        MockChatClient.return_value = chat_llm_mock

        resp = await client.post("/chat", json={"message": "What time does it close today?"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["web_search_used"] is True
    assert "6 PM" in data["reply"]


@pytest.mark.asyncio
async def test_chat_no_search_for_history(client):
    """Historical question skips web search; web_search_used=False."""
    llm_reply = "Gyeongbokgung was built in 1395 by the Joseon dynasty."

    with patch("server.services.web_search.httpx.AsyncClient") as MockSearchClient, \
         patch("server.routers.chat.httpx.AsyncClient") as MockChatClient:

        # Classifier says NO
        classifier_mock = AsyncMock()
        classifier_mock.post.return_value = _make_openrouter_response("NO")
        classifier_mock.__aenter__ = AsyncMock(return_value=classifier_mock)
        classifier_mock.__aexit__ = AsyncMock(return_value=False)
        MockSearchClient.return_value = classifier_mock

        chat_llm_mock = AsyncMock()
        chat_llm_mock.post.return_value = _make_openrouter_response(llm_reply)
        chat_llm_mock.__aenter__ = AsyncMock(return_value=chat_llm_mock)
        chat_llm_mock.__aexit__ = AsyncMock(return_value=False)
        MockChatClient.return_value = chat_llm_mock

        resp = await client.post("/chat", json={"message": "Who built this palace?"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["web_search_used"] is False
