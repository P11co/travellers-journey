"""
models.py — Pydantic schemas for the SeoulWalk API

Defines request/response models for itinerary generation,
chat, handoff, and session management.
"""

from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Itinerary
# ---------------------------------------------------------------------------

class ItineraryGenerateRequest(BaseModel):
    """Request body for POST /itinerary/generate"""
    location: str = Field(
        ...,
        description="Primary area the user wants to explore (e.g. 'Gwanghwamun')",
        examples=["Gwanghwamun"],
    )
    hotspots: list[str] = Field(
        ...,
        description="Selected points of interest to include",
        examples=[["Gyeongbokgung Palace", "National Palace Museum", "Bukchon Hanok Village"]],
    )
    budget_krw: int | None = Field(
        None,
        description="Optional budget in KRW",
        examples=[50000],
    )
    available_hours: float = Field(
        ...,
        description="How many hours the user has",
        examples=[4.0],
    )
    start_time: str = Field(
        "10:00",
        description="Desired start time in HH:MM format",
        examples=["10:00"],
    )
    session_id: str | None = Field(
        None,
        description="Existing session ID to attach the itinerary to. If omitted, a new session is created.",
    )
    allow_ai_fill: bool = Field(
        False,
        description="If true, the planner may add extra known hotspots when selected stops leave substantial free time.",
    )


class ItineraryItem(BaseModel):
    """A single stop in the generated itinerary."""
    order: int
    time: str = Field(..., description="Scheduled time, e.g. '10:00 AM'")
    place: str
    activity: str
    duration_minutes: int
    estimated_cost_krw: int = 0
    latitude: float | None = None
    longitude: float | None = None
    naver_map_url: str | None = None


class ItineraryResponse(BaseModel):
    """Response from POST /itinerary/generate and GET /itinerary/{session_id}"""
    session_id: str
    location: str
    items: list[ItineraryItem]
    total_estimated_cost_krw: int = 0
    created_at: str | None = None


class ItineraryReorderRequest(BaseModel):
    """Request body for PUT /itinerary/{session_id}/reorder"""
    item_order: list[int] = Field(
        ...,
        description="New ordering of item IDs",
        examples=[[3, 1, 2, 4]],
    )


# ---------------------------------------------------------------------------
# Chat / RAG
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Request body for POST /chat"""
    message: str
    session_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    waypoint_id: str | None = None
    model_override: str | None = Field(
        None,
        description="Override the default LLM model ID (e.g. for debug dashboard model switching)"
    )
    provider: str | None = Field(
        None,
        description="Deprecated. Non-vision LLM requests always use NVIDIA NIM."
    )


class ChatResponse(BaseModel):
    """Response from POST /chat"""
    reply: str
    session_id: str
    waypoint_id: str | None = None
    action: str | None = None
    action_payload: dict | None = None
    web_search_used: bool = False
    debug_trace: dict | None = None


# ---------------------------------------------------------------------------
# Vision Chat
# ---------------------------------------------------------------------------

class VisionChatRequest(BaseModel):
    """Request body for POST /chat/vision"""
    message: str = Field(
        default="What is this?",
        description="User's question about the photo",
    )
    image_base64: str = Field(
        ...,
        description="Base64-encoded image (JPEG or PNG, without the data URI prefix)",
    )
    image_mime_type: str = Field(
        default="image/jpeg",
        description="MIME type of the image, e.g. image/jpeg or image/png",
    )
    session_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    waypoint_id: str | None = None


class VisionChatResponse(BaseModel):
    """Response from POST /chat/vision"""
    reply: str
    session_id: str
    waypoint_id: str | None = None
    identified_subject: str | None = Field(
        None,
        description="Best guess at what was identified in the photo (e.g. 'Geunjeongjeon Throne Hall')",
    )
    debug_trace: dict | None = None


# ---------------------------------------------------------------------------
# Handoff (Naver Maps)
# ---------------------------------------------------------------------------

class HandoffRequest(BaseModel):
    """Request body for POST /handoff/naver-map"""
    place_name: str
    latitude: float
    longitude: float


class HandoffResponse(BaseModel):
    """Response from POST /handoff/naver-map"""
    place_name: str
    naver_app_url: str = Field(
        ..., description="Deep link to open in the Naver Map app"
    )
    naver_web_url: str = Field(
        ..., description="Fallback web URL if the app is not installed"
    )


# ---------------------------------------------------------------------------
# Activity Logging
# ---------------------------------------------------------------------------

class ActivityLogRequest(BaseModel):
    """Request body for POST /activity/log"""
    session_id: str
    latitude: float
    longitude: float
    timestamp: str | None = Field(
        None,
        description="ISO 8601 timestamp. If omitted, server uses current time.",
    )


class ActivityLogResponse(BaseModel):
    """Response from POST /activity/log"""
    status: str = "logged"
    session_id: str
    matched_waypoint_id: str | None = None
    matched_waypoint_name: str | None = None


class ActivitySummaryResponse(BaseModel):
    """Response from GET /activity/{session_id}/summary"""
    session_id: str
    total_logs: int
    visited_waypoints: list[str]
    summary_text: str
    logs: list[dict]


# ---------------------------------------------------------------------------
# Session / Health
# ---------------------------------------------------------------------------

class SessionResponse(BaseModel):
    session_id: str
    created_at: str


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.3.0"
