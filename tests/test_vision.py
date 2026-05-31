"""
test_vision.py — Tests for the POST /chat/vision endpoint

The vision endpoint now runs a two-pass flow:
  1. NVIDIA vision model returns structured image evidence
  2. Standard SeoulWalk text chat policy produces the final user-facing answer
"""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException


# A minimal 1x1 pixel white JPEG in base64 (valid image, tiny size)
_TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U"
    "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN"
    "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA//EABQQ"
    "AAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAA"
    "AAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k="
)


def _analysis_json(
    subject="Gwanghwamun Gate",
    confidence="high",
    draft="This appears to be Gwanghwamun Gate.",
    uncertainties=None,
) -> str:
    return json.dumps({
        "identified_subject": subject,
        "confidence": confidence,
        "visual_summary": "A traditional Korean palace structure is visible.",
        "visible_text": None,
        "safety_or_weather_cues": None,
        "draft_answer": draft,
        "uncertainties": uncertainties or [],
    })


def _patch_common(final_intent="RAG"):
    return (
        patch("server.routers.chat.classify_intent", new=AsyncMock(return_value=final_intent)),
        patch("server.routers.chat._get_live_environment", new=AsyncMock(return_value="Current Time: test")),
        patch("server.routers.chat.get_map_snapshot", new=AsyncMock(return_value=None)),
        patch("server.routers.chat.search_rag", return_value="PALACE_KNOWLEDGE: test context"),
    )


@pytest.fixture(autouse=True)
def _vision_api_key(monkeypatch):
    """Vision tests mock LLM calls, so only sentinel keys are needed."""
    monkeypatch.setattr("server.routers.chat.NVIDIA_API_KEY", "test-nvidia-key")
    monkeypatch.setattr("server.routers.chat.VISION_MODEL_ID", "meta/llama-3.2-11b-vision-instruct")


@pytest.mark.asyncio
async def test_vision_basic_two_pass_final_answer(client):
    """Vision endpoint returns the second-pass SeoulWalk answer, not the raw vision draft."""
    final_reply = "This is Gwanghwamun, the main gate of Gyeongbokgung Palace."
    mock_llm = AsyncMock(side_effect=[
        _analysis_json(draft="Raw vision draft that should not be final."),
        final_reply,
    ])

    common = _patch_common()
    with common[0], common[1], common[2], common[3], patch("server.routers.chat._call_llm", new=mock_llm):
        resp = await client.post("/chat/vision", json={
            "message": "What is this gate?",
            "image_base64": _TINY_JPEG_B64,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["reply"] == final_reply
    assert data["identified_subject"] == "Gwanghwamun Gate"
    assert "session_id" in data
    assert mock_llm.await_count == 2
    assert data["debug_trace"]["vision_pipeline"] == "vision_analysis_then_text_chat"


@pytest.mark.asyncio
async def test_vision_second_pass_uses_main_prompt_and_image_context(client):
    """Final vision response goes through the same main SeoulWalk prompt as text chat."""
    mock_llm = AsyncMock(side_effect=[
        _analysis_json(subject="Geunjeongjeon Throne Hall"),
        "This appears to be Geunjeongjeon, the main ceremonial hall.",
    ])

    common = _patch_common()
    with common[0], common[1], common[2], common[3], patch("server.routers.chat._call_llm", new=mock_llm):
        resp = await client.post("/chat/vision", json={
            "message": "What is this?",
            "image_base64": _TINY_JPEG_B64,
            "waypoint_id": "geunjeongjeon",
        })

    assert resp.status_code == 200
    trace = resp.json()["debug_trace"]
    assert "### 8. Itinerary Context Rule" in trace["full_prompt"]
    assert "### 9. Directions & Map Handoff Rule" in trace["full_prompt"]
    final_user_content = trace["messages_sent"][-1]["content"]
    assert "The user just submitted an image" in final_user_content
    assert "Identified subject: Geunjeongjeon Throne Hall" in final_user_content
    assert _TINY_JPEG_B64 not in json.dumps(trace)


@pytest.mark.asyncio
async def test_vision_with_waypoint_returns_spatial_context(client):
    """Vision with waypoint_id still resolves and returns waypoint context."""
    mock_llm = AsyncMock(side_effect=[
        _analysis_json(subject="Geunjeongjeon Throne Hall"),
        "You are looking at Geunjeongjeon, the main throne hall.",
    ])

    common = _patch_common()
    with common[0], common[1], common[2], common[3], patch("server.routers.chat._call_llm", new=mock_llm):
        resp = await client.post("/chat/vision", json={
            "message": "What is the big hall I'm looking at?",
            "image_base64": _TINY_JPEG_B64,
            "waypoint_id": "geunjeongjeon",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["waypoint_id"] == "geunjeongjeon"
    assert data["identified_subject"] == "Geunjeongjeon Throne Hall"


@pytest.mark.asyncio
async def test_vision_with_coordinates_auto_detects_waypoint(client):
    """Vision with lat/lng auto-detects waypoint from coordinates."""
    mock_llm = AsyncMock(side_effect=[
        _analysis_json(subject="Gyeonghoeru Pavilion"),
        "This appears to be Gyeonghoeru Pavilion, used for royal banquets.",
    ])

    common = _patch_common()
    with common[0], common[1], common[2], common[3], patch("server.routers.chat._call_llm", new=mock_llm):
        resp = await client.post("/chat/vision", json={
            "message": "What is this pavilion?",
            "image_base64": _TINY_JPEG_B64,
            "latitude": 37.57962,
            "longitude": 126.97598,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["waypoint_id"] == "gyeonghoeru"


@pytest.mark.asyncio
async def test_vision_unstructured_first_pass_is_wrapped(client):
    """Unstructured vision output is tolerated and passed into final text policy."""
    mock_llm = AsyncMock(side_effect=[
        "This looks like a palace gate, but I am not fully sure.",
        "It may be a palace gate. Based on your location, I would treat that as uncertain.",
    ])

    common = _patch_common()
    with common[0], common[1], common[2], common[3], patch("server.routers.chat._call_llm", new=mock_llm):
        resp = await client.post("/chat/vision", json={
            "message": "What is this?",
            "image_base64": _TINY_JPEG_B64,
        })

    assert resp.status_code == 200
    analysis = resp.json()["debug_trace"]["vision_analysis"]
    assert analysis["confidence"] == "low"
    assert "unstructured output" in analysis["uncertainties"][0].lower()


@pytest.mark.asyncio
async def test_vision_amenity_request_returns_naver_search_payload(client):
    """Image-based amenity requests reuse deterministic Naver handoff behavior."""
    mock_llm = AsyncMock(side_effect=[
        _analysis_json(subject=None, confidence="low", draft="The image does not identify a restroom."),
        "There may be restrooms nearby. I can also search Naver for bathrooms nearby.",
    ])

    common = _patch_common(final_intent="MAP_GEOCODE")
    with common[0], common[1], common[2], common[3], patch("server.routers.chat._call_llm", new=mock_llm):
        resp = await client.post("/chat/vision", json={
            "message": "Where is the closest bathroom in this area?",
            "image_base64": _TINY_JPEG_B64,
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


@pytest.mark.asyncio
async def test_vision_missing_image_returns_422(client):
    """Missing image_base64 field returns 422 Unprocessable Entity."""
    resp = await client.post("/chat/vision", json={"message": "What is this?"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_vision_llm_error_returns_502(client):
    """First-pass LLM API error returns 502 Bad Gateway."""
    mock_llm = AsyncMock(side_effect=HTTPException(status_code=502, detail="Vision failed"))

    with patch("server.routers.chat._call_llm", new=mock_llm):
        resp = await client.post("/chat/vision", json={"image_base64": _TINY_JPEG_B64})

    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_vision_reuses_session(client):
    """Vision endpoint reuses an existing session_id across two-pass calls."""
    mock_llm = AsyncMock(side_effect=[
        _analysis_json(subject="Ticket booth"),
        "This appears to be the ticket booth area.",
        _analysis_json(subject="Ticket booth"),
        "This still appears to be the ticket booth area.",
    ])

    common = _patch_common()
    with common[0], common[1], common[2], common[3], patch("server.routers.chat._call_llm", new=mock_llm):
        r1 = await client.post("/chat/vision", json={"image_base64": _TINY_JPEG_B64})
        sid = r1.json()["session_id"]
        r2 = await client.post("/chat/vision", json={
            "image_base64": _TINY_JPEG_B64,
            "session_id": sid,
        })

    assert r2.json()["session_id"] == sid
