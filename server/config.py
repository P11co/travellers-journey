"""
config.py — SeoulWalk API Server Configuration

Loads environment variables from the tour-guide-app/.env file
and exposes them as module-level constants.
"""

import os
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# .env loading — reuse the same .env as the frontend
# ---------------------------------------------------------------------------
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_PATH = os.path.join(_PROJECT_ROOT, "tour-guide-app", ".env")
load_dotenv(_ENV_PATH)

# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------
OPENROUTER_API_KEY: str = (
    os.getenv("EXPO_PUBLIC_OPENROUTER_API_KEY")
    or os.getenv("OPENROUTER_API_KEY")
    or ""
)

ASSEMBLYAI_API_KEY: str = (
    os.getenv("EXPO_PUBLIC_ASSEMBLYAI_API_KEY")
    or os.getenv("ASSEMBLYAI_API_KEY")
    or ""
)

DEEPGRAM_API_KEY: str = (
    os.getenv("EXPO_PUBLIC_DEEPGRAM_API_KEY")
    or os.getenv("DEEPGRAM_API_KEY")
    or ""
)
DEEPGRAM_TTS_MODEL_ID: str = os.getenv("DEEPGRAM_TTS_MODEL_ID") or "aura-2-thalia-en"

TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY") or ""
NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY") or ""

# Optional LangSmith tracing. The LangSmith SDK reads these environment
# variables directly; these constants make the settings visible to the app.
LANGSMITH_TRACING: str = os.getenv("LANGSMITH_TRACING") or "false"
LANGSMITH_ENDPOINT: str = os.getenv("LANGSMITH_ENDPOINT") or ""
LANGSMITH_API_KEY: str = os.getenv("LANGSMITH_API_KEY") or ""
LANGSMITH_PROJECT: str = os.getenv("LANGSMITH_PROJECT") or "seoulwalk-user-study"

# Naver Maps API keys
NAVER_MAP_CLIENT_ID: str = os.getenv("NAVER_MAP_CLIENT_ID") or ""
NAVER_MAP_CLIENT_SECRET: str = os.getenv("NAVER_MAP_CLIENT_SECRET") or ""

# ---------------------------------------------------------------------------
# LLM Config
# ---------------------------------------------------------------------------
# Default text model used for chat and itinerary generation.
LLM_MODEL_ID: str = os.getenv("LLM_MODEL_ID") or "deepseek/deepseek-v4-flash"
# Vision requests default to the Xiaomi MiMo model.
VISION_MODEL_ID: str = (
    os.getenv("VISION_MODEL_ID")
    or os.getenv("NVIDIA_VISION_MODEL_ID")
    or "xiaomi/mimo-v2.5"
)
OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1/chat/completions"
NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1/chat/completions"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASE_PATH: str = os.path.join(_PROJECT_ROOT, "data", "seoulwalk.db")

# ---------------------------------------------------------------------------
# Waypoints data (shared with the frontend)
# ---------------------------------------------------------------------------
import json

_WAYPOINTS_PATH = os.path.join(
    _PROJECT_ROOT, "tour-guide-app", "src", "data", "waypoints.json"
)
_HOTSPOTS_PATH = os.path.join(
    _PROJECT_ROOT, "tour-guide-app", "src", "data", "hotspots.json"
)

def load_waypoints() -> list[dict]:
    """Load the shared waypoints JSON file."""
    if os.path.exists(_WAYPOINTS_PATH):
        with open(_WAYPOINTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

WAYPOINTS: list[dict] = load_waypoints()

def load_hotspots() -> list[dict]:
    """Load the shared hotspot JSON file."""
    if os.path.exists(_HOTSPOTS_PATH):
        with open(_HOTSPOTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

HOTSPOTS: list[dict] = load_hotspots()
