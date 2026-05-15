"""
conftest.py — Shared fixtures for SeoulWalk API tests

Provides:
  - An isolated test database (in-memory or temp file)
  - A configured httpx AsyncClient wired to the FastAPI test app
"""

import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Override the database path BEFORE importing any server modules
# so that tests use an isolated DB file instead of the real one
_TEST_DB = os.path.join(
    os.path.dirname(__file__), "..", "data", "test_seoulwalk.db"
)
os.environ["SEOULWALK_TEST_DB"] = _TEST_DB

# Patch the config's DATABASE_PATH before the app is loaded
import server.config as _cfg
_cfg.DATABASE_PATH = _TEST_DB

import server.database as _db
_db.DATABASE_PATH = _TEST_DB

from server.main import app
from server.database import init_db


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Create a fresh database for each test, then tear it down."""
    # Ensure data/ dir exists
    os.makedirs(os.path.dirname(_TEST_DB), exist_ok=True)

    # Remove leftover test DB
    if os.path.exists(_TEST_DB):
        os.remove(_TEST_DB)

    await init_db()
    yield
    # Cleanup
    if os.path.exists(_TEST_DB):
        os.remove(_TEST_DB)


@pytest_asyncio.fixture
async def client():
    """Provide an httpx AsyncClient bound to the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
