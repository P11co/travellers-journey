"""
test_map_snapshot.py — Unit tests for the map snapshot service (Task 4)
"""

import pytest
from unittest.mock import patch, AsyncMock
import httpx
from server.services.map_snapshot import get_map_snapshot, MOCK_MAP_B64


@pytest.mark.asyncio
async def test_get_map_snapshot_fallback():
    """get_map_snapshot returns the mock map base64 if Naver API keys are missing."""
    with patch("server.services.map_snapshot.NAVER_MAP_CLIENT_ID", ""), \
         patch("server.services.map_snapshot.NAVER_MAP_CLIENT_SECRET", ""):
        
        snapshot = await get_map_snapshot(latitude=37.5796, longitude=126.9770)
        assert snapshot == MOCK_MAP_B64


@pytest.mark.asyncio
async def test_get_map_snapshot_success():
    """get_map_snapshot returns base64 content on successful Naver Maps API response."""
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR..."
    
    with patch("server.services.map_snapshot.NAVER_MAP_CLIENT_ID", "fake-client-id"), \
         patch("server.services.map_snapshot.NAVER_MAP_CLIENT_SECRET", "fake-client-secret"), \
         patch("httpx.AsyncClient.get") as mock_get:
        
        mock_resp = httpx.Response(status_code=200, content=fake_png)
        mock_get.return_value = mock_resp
        
        snapshot = await get_map_snapshot(latitude=37.5796, longitude=126.9770)
        assert snapshot is not None
        assert snapshot != MOCK_MAP_B64
        assert len(snapshot) > 0


@pytest.mark.asyncio
async def test_get_map_snapshot_failure_fallback():
    """get_map_snapshot falls back to mock map base64 if Naver Maps API returns an error."""
    with patch("server.services.map_snapshot.NAVER_MAP_CLIENT_ID", "fake-client-id"), \
         patch("server.services.map_snapshot.NAVER_MAP_CLIENT_SECRET", "fake-client-secret"), \
         patch("httpx.AsyncClient.get") as mock_get:
        
        mock_resp = httpx.Response(status_code=403, content=b"Unauthorized")
        mock_get.return_value = mock_resp
        
        snapshot = await get_map_snapshot(latitude=37.5796, longitude=126.9770)
        assert snapshot == MOCK_MAP_B64
