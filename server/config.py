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

TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY") or ""
NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY") or ""

# ---------------------------------------------------------------------------
# LLM Config
# ---------------------------------------------------------------------------
# Default model used for all tasks: chat, itinerary generation, and vision
LLM_MODEL_ID: str = "google/gemma-4-26b-a4b-it:free"
# Separate vision model that accepts image inputs (same provider)
VISION_MODEL_ID: str = "google/gemma-4-26b-a4b-it:free"
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

def load_waypoints() -> list[dict]:
    """Load the shared waypoints JSON file."""
    if os.path.exists(_WAYPOINTS_PATH):
        with open(_WAYPOINTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

WAYPOINTS: list[dict] = load_waypoints()
