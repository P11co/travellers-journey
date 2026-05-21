"""
test_activity_router.py — Tests for the activity router endpoints (Task 2)
"""

import pytest

@pytest.mark.asyncio
async def test_log_activity_no_waypoint(client):
    """POST /activity/log with coordinates far from any waypoint logs correctly but matches no waypoint."""
    resp = await client.post("/activity/log", json={
        "session_id": "router-test-1",
        "latitude": 37.0,
        "longitude": 126.0,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "router-test-1"
    assert data["matched_waypoint_id"] is None
    assert data["matched_waypoint_name"] is None


@pytest.mark.asyncio
async def test_log_activity_with_waypoint(client):
    """POST /activity/log with coordinates near Geunjeongjeon matches it."""
    resp = await client.post("/activity/log", json={
        "session_id": "router-test-2",
        # Geunjeongjeon coordinates
        "latitude": 37.57865,
        "longitude": 126.97711,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "router-test-2"
    assert data["matched_waypoint_id"] == "geunjeongjeon"
    assert data["matched_waypoint_name"] == "Geunjeongjeon Throne Hall"


@pytest.mark.asyncio
async def test_get_activity_summary(client):
    """GET /activity/{session_id}/summary returns the travel summary correctly."""
    session_id = "router-test-3"
    
    # 1. Check empty summary
    resp_empty = await client.get(f"/activity/{session_id}/summary")
    assert resp_empty.status_code == 200
    assert resp_empty.json()["summary_text"] == "No activity recorded yet."

    # 2. Log first activity (no waypoint)
    await client.post("/activity/log", json={
        "session_id": session_id,
        "latitude": 37.5,
        "longitude": 126.5,
    })

    # 3. Log second activity (Geunjeongjeon)
    await client.post("/activity/log", json={
        "session_id": session_id,
        "latitude": 37.57865,
        "longitude": 126.97711,
    })

    # 4. Check summary
    resp = await client.get(f"/activity/{session_id}/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert data["total_logs"] == 2
    assert "Geunjeongjeon Throne Hall" in data["visited_waypoints"]
    assert "User journey" in data["summary_text"]


@pytest.mark.asyncio
async def test_log_activity_optimization(client):
    """POST /activity/log reuses the last map snapshot if the coordinates are extremely close."""
    from unittest.mock import patch, AsyncMock
    session_id = "opt-session-1"
    
    with patch("server.routers.activity.get_map_snapshot", new_callable=AsyncMock) as mock_get_map:
        mock_get_map.return_value = "fake_b64_string_123"
        
        # 1. Log first GPS ping (calls map snapshot)
        resp1 = await client.post("/activity/log", json={
            "session_id": session_id,
            "latitude": 37.5796,
            "longitude": 126.9770,
        })
        assert resp1.status_code == 200
        assert mock_get_map.call_count == 1
        
        # 2. Log second GPS ping with very close coordinates (moved < 11 meters, i.e., lat diff < 0.0001)
        resp2 = await client.post("/activity/log", json={
            "session_id": session_id,
            "latitude": 37.57965, # only 0.00005 diff
            "longitude": 126.97705, # only 0.00005 diff
        })
        assert resp2.status_code == 200
        # Call count should STILL be 1 because it reused the cached map!
        assert mock_get_map.call_count == 1
        
        # 3. Log third GPS ping with far coordinates (moved > 11 meters)
        resp3 = await client.post("/activity/log", json={
            "session_id": session_id,
            "latitude": 37.5900, # moved far away
            "longitude": 126.9800,
        })
        assert resp3.status_code == 200
        # Call count should now be 2 because it generated a new map!
        assert mock_get_map.call_count == 2
