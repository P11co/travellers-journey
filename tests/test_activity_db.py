"""
test_activity_db.py — Unit tests for the activity logs database layer (Task 1)
"""

import pytest
from server.database import (
    create_session,
    save_activity_log,
    get_activity_logs,
)

@pytest.mark.asyncio
async def test_activity_logs_empty():
    """get_activity_logs returns empty list if no logs exist."""
    session_id = "test-session-empty"
    # Create session first due to foreign key constraints
    await create_session(session_id, location="Gwanghwamun")
    
    logs = await get_activity_logs(session_id)
    assert logs == []


@pytest.mark.asyncio
async def test_save_and_get_activity_logs():
    """save_activity_log inserts a row successfully, and get_activity_logs retrieves it."""
    session_id = "test-session-1"
    await create_session(session_id, location="Gwanghwamun")

    # Save a single log
    await save_activity_log(
        session_id=session_id,
        latitude=37.5796,
        longitude=126.9770,
        matched_waypoint_id="gyeongbokgung",
        map_snapshot_b64="fake-b64-string",
    )

    logs = await get_activity_logs(session_id)
    assert len(logs) == 1
    
    log = logs[0]
    assert log["latitude"] == pytest.approx(37.5796)
    assert log["longitude"] == pytest.approx(126.9770)
    assert log["matched_waypoint_id"] == "gyeongbokgung"
    assert log["map_snapshot_b64"] == "fake-b64-string"
    assert "timestamp" in log


@pytest.mark.asyncio
async def test_activity_logs_ordering_and_limit():
    """Activity logs are returned in chronological order and respect the limit parameter."""
    session_id = "test-session-2"
    await create_session(session_id, location="Gwanghwamun")

    # Save multiple logs with coordinate variations to verify order
    coords = [
        (37.5701, 126.9701),
        (37.5702, 126.9702),
        (37.5703, 126.9703),
    ]

    for lat, lng in coords:
        await save_activity_log(
            session_id=session_id,
            latitude=lat,
            longitude=lng,
        )

    # Verify chronological order
    logs = await get_activity_logs(session_id)
    assert len(logs) == 3
    assert logs[0]["latitude"] == pytest.approx(37.5701)
    assert logs[1]["latitude"] == pytest.approx(37.5702)
    assert logs[2]["latitude"] == pytest.approx(37.5703)

    # Test limit parameter
    limited_logs = await get_activity_logs(session_id, limit=2)
    assert len(limited_logs) == 2
    assert limited_logs[0]["latitude"] == pytest.approx(37.5701)
    assert limited_logs[1]["latitude"] == pytest.approx(37.5702)
