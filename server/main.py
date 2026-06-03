"""
main.py — SeoulWalk FastAPI Application

Entry point for the API server. Run with:
    uvicorn server.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server.database import init_db
from server.models import HealthResponse
from server.routers import itinerary, chat, handoff, activity, voice
from server.config import ASSETS_DIR


# ---------------------------------------------------------------------------
# Lifespan — runs once on startup/shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database on startup."""
    await init_db()
    print("✅ SeoulWalk API server started — database initialized.")
    yield
    print("👋 SeoulWalk API server shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SeoulWalk Tour Guide API",
    description=(
        "Backend API for the SeoulWalk AI tour guide application. "
        "Provides itinerary generation, chat/RAG, and Naver Maps handoff."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — allow the React Native / Expo dev client to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(itinerary.router)
app.include_router(chat.router)
app.include_router(handoff.router)
app.include_router(activity.router)
app.include_router(voice.router)
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    return HealthResponse()
