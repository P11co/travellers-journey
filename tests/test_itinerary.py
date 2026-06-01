"""
test_itinerary.py — Tests for the Itinerary endpoints

Tests:
  1. POST /itinerary/generate (mocked LLM)
  2. GET  /itinerary/{session_id}
  3. PUT  /itinerary/{session_id}/reorder
  4. DELETE /itinerary/{session_id}
  5. Edge cases (404s, invalid reorder)
"""

import pytest
from unittest.mock import AsyncMock, patch

# ---------------------------------------------------------------------------
# Mock LLM response — a valid itinerary JSON array
# ---------------------------------------------------------------------------
_MOCK_LLM_ITEMS = [
    {
        "order": 1,
        "time": "10:00 AM",
        "place": "Gwanghwamun Gate",
        "activity": "Arrive and take photos",
        "duration_minutes": 20,
        "estimated_cost_krw": 0,
        "latitude": 37.57602,
        "longitude": 126.97685,
    },
    {
        "order": 2,
        "time": "10:30 AM",
        "place": "Gyeongbokgung Palace",
        "activity": "Palace tour",
        "duration_minutes": 90,
        "estimated_cost_krw": 3000,
        "latitude": 37.57865,
        "longitude": 126.97711,
    },
    {
        "order": 3,
        "time": "12:00 PM",
        "place": "Tosokchon Samgyetang",
        "activity": "Lunch — try ginseng chicken soup",
        "duration_minutes": 60,
        "estimated_cost_krw": 16000,
        "latitude": None,
        "longitude": None,
    },
]

_mock_llm = AsyncMock(return_value=_MOCK_LLM_ITEMS)


# ---------------------------------------------------------------------------
# POST /itinerary/generate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_generate_itinerary(client):
    """Generate an itinerary and verify the response structure."""
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Gyeongbokgung Palace", "Tosokchon"],
        "budget_krw": 50000,
        "available_hours": 4.0,
        "start_time": "10:00",
    })
    assert resp.status_code == 200
    data = resp.json()

    assert "session_id" in data
    assert data["location"] == "Gwanghwamun"
    assert len(data["items"]) == 3
    assert data["items"][0]["place"] == "Gwanghwamun Gate"
    assert data["items"][1]["estimated_cost_krw"] == 3000
    assert data["total_estimated_cost_krw"] == 19000

    # First two items have coordinates, so they should get Naver URLs
    assert data["items"][0]["naver_map_url"] is not None
    assert "nmap://" in data["items"][0]["naver_map_url"]
    # Third item has no coordinates
    assert data["items"][2]["naver_map_url"] is None

    return data["session_id"]


# ---------------------------------------------------------------------------
# GET /itinerary/{session_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_get_itinerary(client):
    """Retrieve a previously generated itinerary."""
    # First generate
    gen_resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Palace"],
        "available_hours": 3.0,
    })
    session_id = gen_resp.json()["session_id"]

    # Then retrieve
    resp = await client.get(f"/itinerary/{session_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert len(data["items"]) == 3


@pytest.mark.asyncio
async def test_get_itinerary_not_found(client):
    """Requesting a nonexistent session returns 404."""
    resp = await client.get("/itinerary/nonexistent-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PUT /itinerary/{session_id}/reorder
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_reorder_itinerary(client):
    """Reorder itinerary items and verify the new order."""
    # Generate
    gen_resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Palace"],
        "available_hours": 3.0,
    })
    session_id = gen_resp.json()["session_id"]

    # Reorder: reverse the order (3, 2, 1)
    resp = await client.put(f"/itinerary/{session_id}/reorder", json={
        "item_order": [3, 2, 1],
    })
    assert resp.status_code == 200
    data = resp.json()

    # After reorder, item at position 1 should be what was originally order=3
    assert data["items"][0]["place"] == "Tosokchon Samgyetang"
    assert data["items"][2]["place"] == "Gwanghwamun Gate"


@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_reorder_invalid(client):
    """Invalid reorder (wrong count) returns 400."""
    gen_resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Palace"],
        "available_hours": 3.0,
    })
    session_id = gen_resp.json()["session_id"]

    resp = await client.put(f"/itinerary/{session_id}/reorder", json={
        "item_order": [1, 2],  # Only 2 items, but there are 3
    })
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# DELETE /itinerary/{session_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_delete_itinerary(client):
    """Delete a session and verify it's gone."""
    gen_resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Palace"],
        "available_hours": 3.0,
    })
    session_id = gen_resp.json()["session_id"]

    # Delete
    resp = await client.delete(f"/itinerary/{session_id}")
    assert resp.status_code == 200

    # Confirm it's gone
    resp = await client.get(f"/itinerary/{session_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent(client):
    """Deleting a nonexistent session returns 404."""
    resp = await client.delete("/itinerary/ghost-session")
    assert resp.status_code == 404


def test_prompt_optimization_rules():
    """Verify that itinerary generation prompts include walking route optimization and arbitrary order rules."""
    from server.routers.itinerary import _build_user_prompt, _ITINERARY_SYSTEM_PROMPT
    from server.models import ItineraryGenerateRequest

    req = ItineraryGenerateRequest(
        location="Gyeongbokgung",
        hotspots=["National Palace Museum of Korea", "Bukchon Hanok Village"],
        budget_krw=30000,
        available_hours=6.0,
        start_time="09:00 AM",
    )
    user_prompt = _build_user_prompt(req)

    # Assert system prompt has the walking optimization rule
    assert "The order of selected hotspots in the request is arbitrary" in _ITINERARY_SYSTEM_PROMPT
    assert "minimizes total walking/travel distance" in _ITINERARY_SYSTEM_PROMPT

    # Assert user prompt has the unordered notification
    assert "The selected hotspot list is unordered" in user_prompt
    assert "most efficient walking route" in user_prompt


@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_generate_itinerary_over_budget(client):
    """If hotspots + walking buffer exceed available hours, return 400."""
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        # Gyeongbokgung Palace is estimated at 120 minutes.
        # National Palace Museum of Korea is estimated at 60 minutes.
        # Tosokchon Samgyetang is estimated at 90 minutes.
        # Total duration = 120 + 60 + 90 = 270 mins.
        # Walking buffer = 15 * (3 - 1) = 30 mins.
        # Total min time required = 300 mins (5.0 hours).
        # We request available_hours = 4.0 (240 mins). This should fail.
        "hotspots": ["Gyeongbokgung Palace", "National Palace Museum of Korea", "Tosokchon Samgyetang"],
        "available_hours": 4.0,
        "start_time": "10:00",
    })
    assert resp.status_code == 400
    assert "Too many stops for a 4-hour itinerary" in resp.json()["detail"]


@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_generate_itinerary_under_budget(client):
    """If hotspots + walking buffer is within available hours, succeed and call LLM."""
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        # Gyeongbokgung Palace (120m) + Tosokchon Samgyetang (90m) = 210 mins.
        # Walking buffer = 15 mins.
        # Total min time required = 225 mins (3.75 hours).
        # We request available_hours = 4.0 (240 mins). This should succeed.
        "hotspots": ["Gyeongbokgung Palace", "Tosokchon Samgyetang"],
        "available_hours": 4.0,
        "start_time": "10:00",
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_generate_itinerary_allow_ai_fill_under_budget(client):
    """AI fill mode enabled does not trigger preflight error if selected hotspots are under budget."""
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        # Selected hotspots: Gyeongbokgung Palace (120m) = 120 mins.
        # Walking buffer = 0 mins.
        # Total min time = 120 mins (2.0 hours).
        # We request available_hours = 2.0 (120 mins) with allow_ai_fill=True.
        # This is valid because only the selected hotspot is counted, not the potential fill pool.
        "hotspots": ["Gyeongbokgung Palace"],
        "available_hours": 2.0,
        "start_time": "10:00",
        "allow_ai_fill": True,
    })
    assert resp.status_code == 200



