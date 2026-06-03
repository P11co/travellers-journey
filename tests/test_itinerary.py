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
import pytest_asyncio
from datetime import datetime
from zoneinfo import ZoneInfo
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
# Routing stub — isolates all tests from Naver API credentials.
# Every pair of hotspots gets a fixed 15-min walk leg so durations and
# route order are deterministic across environments.
# ---------------------------------------------------------------------------
_FIXED_LEG = {
    "mode": "walk",
    "duration_minutes": 10,
    "distance_meters": 670,
    "routing_source": "fallback",
}


@pytest_asyncio.fixture(autouse=True)
async def mock_travel_leg():
    """Patch get_travel_leg at both the source module and the local binding
    in the router so asyncio.gather always gets the stub."""
    with patch(
        "server.services.routing.get_travel_leg",
        new=AsyncMock(return_value=_FIXED_LEG),
    ), patch(
        "server.routers.itinerary.get_travel_leg",
        new=AsyncMock(return_value=_FIXED_LEG),
    ) as mock:
        yield mock


@pytest.fixture(autouse=True)
def fixed_service_datetime():
    """Keep opening-hours tests independent of the actual current weekday."""
    service_dt = datetime(2026, 6, 3, 10, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    with patch("server.routers.itinerary._current_service_datetime", return_value=service_dt):
        yield




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
    assert data["items"][0]["image_url"] == "assets/images/waypoints/main_gate.jpg"
    assert data["items"][1]["image_url"] == "assets/images/hotspots/palace_history_1778862119711.png"
    assert data["items"][2]["image_url"] == "assets/images/hotspots/h_013_tosokchon_samgyetang_1778862490739.png"

    return data["session_id"]


@pytest.mark.asyncio
@pytest.mark.parametrize("start_time", ["invalid_time", "25:00", "13:30 PM"])
async def test_generate_itinerary_invalid_start_time(client, start_time):
    """If start_time is malformed, request should fail validation (422) instead of falling back to 9:00."""
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Gyeongbokgung Palace", "Tosokchon"],
        "available_hours": 4.0,
        "start_time": start_time,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_generate_itinerary_rejects_start_without_public_transport(client):
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Gwanghwamun Square"],
        "available_hours": 2.0,
        "start_time": "01:00",
    })

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "itinerary_public_transport_unavailable"


@pytest.mark.asyncio
async def test_generate_itinerary_rejects_start_with_no_open_selected_hotspots(client):
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Gyeongbokgung Palace", "National Palace Museum of Korea"],
        "available_hours": 4.0,
        "start_time": "08:30",
    })

    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "itinerary_no_open_hotspots_at_start"
    assert {item["name"] for item in detail["closed_hotspots"]} == {
        "Gyeongbokgung Palace",
        "National Palace Museum of Korea",
    }


@pytest.mark.asyncio
async def test_generate_itinerary_rejects_unavailable_hotspot(client):
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Cheong Wa Dae (The Blue House)"],
        "available_hours": 2.0,
        "start_time": "10:00",
    })

    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "itinerary_hotspot_unavailable"
    assert detail["closed_hotspots"][0]["name"] == "Cheong Wa Dae (The Blue House)"


@pytest.mark.asyncio
async def test_generate_itinerary_rejects_closed_scheduled_stop(client):
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Gwangjang Market", "Insadong Hanjeongsik"],
        "available_hours": 4.5,
        "start_time": "19:30",
    })

    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "itinerary_hotspots_closed"
    assert detail["closed_hotspots"]


@pytest.mark.asyncio
async def test_generate_itinerary_uses_weekday_closure_reason(client):
    service_dt = datetime(2026, 6, 2, 10, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    with patch("server.routers.itinerary._current_service_datetime", return_value=service_dt):
        resp = await client.post("/itinerary/generate", json={
            "location": "Gwanghwamun",
            "hotspots": ["Gyeongbokgung Palace", "Gwanghwamun Square"],
            "available_hours": 4.0,
            "start_time": "09:15",
        })

    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "itinerary_hotspots_closed"
    assert "closed on Tuesdays" in detail["message"]
    assert "closed at 09:15 AM" not in detail["message"]


@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary")
async def test_generate_itinerary_late_start_time(mock_llm, client):
    """Generate an itinerary with a late start time and verify the schedule shifts."""
    async def _mock_passthrough(req, skeleton):
        return skeleton

    mock_llm.side_effect = _mock_passthrough

    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Gyeongbokgung Palace", "National Palace Museum of Korea"],
        "available_hours": 4.0,
        "start_time": "13:30",
    })
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    # 13:30 in 12h format is 01:30 PM
    assert items[0]["time"] == "01:30 PM"
    assert items[0]["place"] == "Gyeongbokgung Palace"


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
    assert data["items"][0]["image_url"] == "assets/images/waypoints/main_gate.jpg"


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
    """Verify that itinerary system prompt contains copy editor preservation rules."""
    from server.routers.itinerary import _ITINERARY_SYSTEM_PROMPT

    # Assert system prompt has the strict copy editor rules
    assert "SeoulWalk Itinerary Copy Editor" in _ITINERARY_SYSTEM_PROMPT
    assert "You must preserve:" in _ITINERARY_SYSTEM_PROMPT
    assert "duration_minutes" in _ITINERARY_SYSTEM_PROMPT
    assert "estimated_cost_krw" in _ITINERARY_SYSTEM_PROMPT
    assert "latitude" in _ITINERARY_SYSTEM_PROMPT
    assert "longitude" in _ITINERARY_SYSTEM_PROMPT
    assert "You may only rewrite the activity field" in _ITINERARY_SYSTEM_PROMPT


@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_generate_itinerary_over_budget(client):
    """If hotspots + exact travel legs exceed available hours, return 400."""
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        # Gyeongbokgung Palace (120 min), National Palace Museum (60 min), Tosokchon Samgyetang (90 min).
        # Stub routing gives 2 travel legs × 10 min each = 20 min total travel.
        # Total required = 270 + 20 = 290 min; budget = 4.0 h = 240 min. Should fail.
        "hotspots": ["Gyeongbokgung Palace", "National Palace Museum of Korea", "Tosokchon Samgyetang"],
        "available_hours": 4.0,
        "start_time": "10:00",
    })
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "itinerary_time_budget_exceeded"
    assert detail["available_minutes"] == 240
    assert detail["required_minutes"] == 290
    assert detail["over_by_minutes"] == 50
    assert detail["travel_buffer_minutes"] == 20
    assert len(detail["stops"]) == 5


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


def test_validate_llm_itinerary_helper():
    from server.routers.itinerary import _validate_llm_itinerary
    
    skeleton = [
        {
            "order": 1,
            "time": "09:00 AM",
            "place": "Gyeongbokgung Palace",
            "activity": "Visit Gyeongbokgung Palace.",
            "duration_minutes": 120,
            "estimated_cost_krw": 0,
            "latitude": 37.5796,
            "longitude": 126.977
        },
        {
            "order": 2,
            "time": "11:00 AM",
            "place": "Walk to Bukchon Hanok Village",
            "activity": "Walk to the next stop.",
            "duration_minutes": 20,
            "estimated_cost_krw": 0,
            "latitude": None,
            "longitude": None
        }
    ]
    
    # 1. Valid case (only activity field changed)
    valid_output = [
        {
            "order": 1,
            "time": "09:00 AM",
            "place": "Gyeongbokgung Palace",
            "activity": "Explore the royal palace halls and watch the guard changing ceremony.",
            "duration_minutes": 120,
            "estimated_cost_krw": 0,
            "latitude": 37.5796,
            "longitude": 126.977
        },
        {
            "order": 2,
            "time": "11:00 AM",
            "place": "Walk to Bukchon Hanok Village",
            "activity": "Enjoy a pleasant walk up the hill to Bukchon.",
            "duration_minutes": 20,
            "estimated_cost_krw": 0,
            "latitude": None,
            "longitude": None
        }
    ]
    assert _validate_llm_itinerary(valid_output, skeleton) is not None
    
    # 2. Invalid: Count mismatch
    invalid_count = valid_output[:-1]
    assert _validate_llm_itinerary(invalid_count, skeleton) is None
    
    # 3. Invalid: Order mismatch
    invalid_order = [dict(item) for item in valid_output]
    invalid_order[0]["order"] = 99
    assert _validate_llm_itinerary(invalid_order, skeleton) is None
    
    # 4. Invalid: Duration mismatch
    invalid_duration = [dict(item) for item in valid_output]
    invalid_duration[0]["duration_minutes"] = 130
    assert _validate_llm_itinerary(invalid_duration, skeleton) is None
    
    # 5. Invalid: Time mismatch
    invalid_time = [dict(item) for item in valid_output]
    invalid_time[0]["time"] = "09:15 AM"
    assert _validate_llm_itinerary(invalid_time, skeleton) is None
    
    # 6. Invalid: Place mismatch
    invalid_place = [dict(item) for item in valid_output]
    invalid_place[0]["place"] = "Gyeongbokgung Palace Palace"
    assert _validate_llm_itinerary(invalid_place, skeleton) is None
    
    # 7. Invalid: Cost mismatch
    invalid_cost = [dict(item) for item in valid_output]
    invalid_cost[0]["estimated_cost_krw"] = 5000
    assert _validate_llm_itinerary(invalid_cost, skeleton) is None
    
    # 8. Invalid: Lat/Lng mismatch
    invalid_coords = [dict(item) for item in valid_output]
    invalid_coords[0]["latitude"] = 37.58
    assert _validate_llm_itinerary(invalid_coords, skeleton) is None


@pytest.mark.asyncio
async def test_generate_itinerary_includes_travel_legs(client):
    async def _mock_passthrough(req, skeleton):
        return skeleton

    with patch("server.routers.itinerary.call_llm_for_itinerary", _mock_passthrough):
        resp = await client.post("/itinerary/generate", json={
            "location": "Gwanghwamun",
            "hotspots": ["Gyeongbokgung Palace", "National Palace Museum of Korea"],
            "available_hours": 4.0,
            "start_time": "10:00",
        })
        assert resp.status_code == 200
        items = resp.json()["items"]
        # Should have: Stop 1, Travel leg, Stop 2
        assert len(items) == 3
        assert items[0]["place"] == "Gyeongbokgung Palace"
        assert items[1]["place"] == "Walk to National Palace Museum of Korea"
        assert items[1]["latitude"] is None
        assert items[1]["longitude"] is None
        assert items[1]["routing_source"] is not None
        assert items[1]["image_url"] is None
        assert items[2]["place"] == "National Palace Museum of Korea"
        assert items[0]["image_url"] == "assets/images/hotspots/palace_history_1778862119711.png"
        assert items[2]["image_url"] == "assets/images/hotspots/h_006_palace_museum_1778862402556.png"


@pytest.mark.asyncio
async def test_reorder_rejects_itinerary_with_generated_travel_legs(client):
    async def _mock_passthrough(req, skeleton):
        return skeleton

    with patch("server.routers.itinerary.call_llm_for_itinerary", _mock_passthrough):
        gen_resp = await client.post("/itinerary/generate", json={
            "location": "Gwanghwamun",
            "hotspots": ["Gyeongbokgung Palace", "National Palace Museum of Korea"],
            "available_hours": 4.0,
            "start_time": "10:00",
        })

    assert gen_resp.status_code == 200
    data = gen_resp.json()
    item_order = [item["order"] for item in reversed(data["items"])]

    resp = await client.put(f"/itinerary/{data['session_id']}/reorder", json={
        "item_order": item_order,
    })

    assert resp.status_code == 400


@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_over_budget_error_includes_breakdown(client):
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": ["Gyeongbokgung Palace", "National Palace Museum of Korea", "Tosokchon Samgyetang"],
        "available_hours": 4.0,
        "start_time": "10:00",
    })
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["travel_minutes"] == 20  # 2 legs × 10 min stub each
    assert "breakdown" in detail
    breakdown = detail["breakdown"]
    assert len(breakdown) == 5
    assert breakdown[0]["type"] == "visit"
    assert breakdown[0]["name"] == "Gyeongbokgung Palace"
    assert breakdown[1]["type"] == "walk"
    assert breakdown[1]["name"] == "Walk to National Palace Museum of Korea"
    assert breakdown[2]["type"] == "visit"
    assert breakdown[2]["name"] == "National Palace Museum of Korea"
    assert breakdown[3]["type"] == "walk"
    assert breakdown[3]["name"] == "Walk to Tosokchon Samgyetang"
    assert breakdown[4]["type"] == "visit"
    assert breakdown[4]["name"] == "Tosokchon Samgyetang"


@pytest.mark.asyncio
async def test_llm_cannot_remove_travel_legs():
    from server.routers.itinerary import _validate_llm_itinerary
    skeleton = [
        {"order": 1, "time": "09:00 AM", "place": "Gyeongbokgung Palace", "duration_minutes": 120, "estimated_cost_krw": 0, "latitude": 37.5, "longitude": 126.9},
        {"order": 2, "time": "11:00 AM", "place": "Walk to Bukchon", "duration_minutes": 20, "estimated_cost_krw": 0, "latitude": None, "longitude": None},
        {"order": 3, "time": "11:20 AM", "place": "Bukchon Hanok Village", "duration_minutes": 60, "estimated_cost_krw": 0, "latitude": 37.6, "longitude": 127.0}
    ]
    # LLM output tries to omit the Walk travel leg
    llm_output = [
        {"order": 1, "time": "09:00 AM", "place": "Gyeongbokgung Palace", "duration_minutes": 120, "estimated_cost_krw": 0, "latitude": 37.5, "longitude": 126.9},
        {"order": 2, "time": "11:00 AM", "place": "Bukchon Hanok Village", "duration_minutes": 60, "estimated_cost_krw": 0, "latitude": 37.6, "longitude": 127.0}
    ]
    assert _validate_llm_itinerary(llm_output, skeleton) is None


@pytest.mark.asyncio
@patch("server.routers.itinerary.call_llm_for_itinerary", _mock_llm)
async def test_generate_itinerary_permutation_cap(client):
    resp = await client.post("/itinerary/generate", json={
        "location": "Gwanghwamun",
        "hotspots": [
            "Gyeongbokgung Palace",
            "Gwanghwamun Square",
            "Deoksugung Palace",
            "Deoksugung Stone-wall Road",
            "Cheong Wa Dae (The Blue House)",
            "National Palace Museum of Korea",
            "Bukchon Hanok Village",
            "Seochon Village"
        ], # 8 valid hotspots -> exceeds cap of 7
        "available_hours": 8.0,
        "start_time": "10:00",
    })
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "too_many_hotspots"
    assert "Too many selected stops" in detail["message"]
