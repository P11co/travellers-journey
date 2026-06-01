import pytest
from unittest.mock import patch
from server.services.routing import get_travel_leg, haversine_distance, round_up_to_5


def test_haversine_distance():
    # Gyeongbokgung to Gwanghwamun Square (approx 780m)
    dist = haversine_distance(37.5796, 126.977, 37.5726, 126.9769)
    assert 700 <= dist <= 900


def test_round_up_to_5():
    assert round_up_to_5(3.2) == 5
    assert round_up_to_5(5.0) == 5
    assert round_up_to_5(5.1) == 10
    assert round_up_to_5(24.5) == 25
    assert round_up_to_5(0) == 5


@pytest.mark.asyncio
@patch("server.services.routing.fetch_driving_route")
async def test_get_travel_leg_walk(mock_fetch):
    # Mock short distance (e.g. 500 meters)
    mock_fetch.return_value = (500.0, 2.0)

    # 500m / 67m/min = 7.46 mins -> rounds up to 10 mins (walk)
    leg = await get_travel_leg(37.5796, 126.977, 37.5765, 126.9758)
    assert leg["mode"] == "walk"
    assert leg["duration_minutes"] == 10
    assert leg["distance_meters"] == 500


@pytest.mark.asyncio
@patch("server.services.routing.fetch_driving_route")
async def test_get_travel_leg_taxi(mock_fetch):
    # Mock long distance (e.g. 3000 meters, driving duration 8 mins)
    mock_fetch.return_value = (3000.0, 8.0)

    # 3000m / 67m/min = 44.7 mins (> 25 mins) -> taxi
    # driving duration + 5 = 8 + 5 = 13 mins -> rounds up to 15 mins (taxi)
    leg = await get_travel_leg(37.5796, 126.977, 37.5658, 126.9751)
    assert leg["mode"] == "taxi"
    assert leg["duration_minutes"] == 15
    assert leg["distance_meters"] == 3000


@pytest.mark.asyncio
@patch("server.services.routing.fetch_driving_route")
async def test_get_travel_leg_fallback(mock_fetch):
    # Mock API failure by returning None
    mock_fetch.return_value = None

    # Use coordinates for Palace to Square (approx 780m)
    # Fallback distance = 780 * 1.3 = 1014m
    # 1014 / 67 = 15.1 mins (<= 25 mins) -> walk -> rounds up to 20 mins
    leg = await get_travel_leg(37.5796, 126.977, 37.5726, 126.9769)
    assert leg["mode"] == "walk"
    assert leg["duration_minutes"] in (15, 20)
