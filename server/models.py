"""
models.py — Pydantic schemas for the SeoulWalk API

Defines request/response models for itinerary generation,
chat, handoff, and session management.
"""

from __future__ import annotations
from datetime import datetime
import re
from pydantic import BaseModel, Field, field_validator


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
        "09:00",
        description="Desired start time in HH:MM format",
        examples=["09:00"],
    )

    @field_validator("start_time")
    @classmethod
    def validate_start_time(cls, value: str) -> str:
        cleaned = (value or "").strip()
        match = re.fullmatch(r"(\d{1,2}):(\d{2})(?:\s*([AP]M))?", cleaned, re.I)
        if not match:
            raise ValueError("start_time must be a valid time such as 09:00 or 1:30 PM")

        hours = int(match.group(1))
        minutes = int(match.group(2))
        meridiem = match.group(3)

        if minutes > 59:
            raise ValueError("start_time minutes must be between 00 and 59")

        if meridiem:
            if hours < 1 or hours > 12:
                raise ValueError("start_time hour must be 1-12 when using AM or PM")
        elif hours < 0 or hours > 23:
            raise ValueError("start_time hour must be 0-23")

        return cleaned
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
    routing_source: str | None = None
    image_url: str | None = None


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
        description="Deprecated. LLM requests use OpenRouter first with NVIDIA NIM fallback."
    )
    developer_mode: bool = Field(
        False,
        description="Return a live, frontend-safe developer trace for this response.",
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
    developer_trace: dict | None = None


class QuickRepliesRequest(BaseModel):
    """Request body for POST /chat/quick-replies"""
    assistant_message: str = Field(
        ...,
        min_length=1,
        max_length=2400,
        description="The assistant's latest final message. No chat history is included.",
    )
    session_id: str | None = Field(
        None,
        description="Optional session ID for trace logging.",
    )
    model_override: str | None = Field(
        None,
        description="Optional model override for debugging quick-reply generation.",
    )


class QuickReplyOption(BaseModel):
    """A single quick reply button."""
    label: str = Field(
        ...,
        min_length=1,
        max_length=36,
        description="Button label and exact text sent when tapped.",
    )

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        cleaned = re.sub(r"\s+", " ", (value or "").strip())
        if not cleaned:
            raise ValueError("label must not be empty")
        if len(cleaned) > 36:
            raise ValueError("label must be 36 characters or fewer")
        return cleaned


class QuickRepliesResponse(BaseModel):
    """Response from POST /chat/quick-replies"""
    options: list[QuickReplyOption] = Field(
        ...,
        max_length=3,
        description="0-3 quick-reply choices. Empty means no buttons should be shown.",
    )


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
    developer_mode: bool = Field(
        False,
        description="Return a live, frontend-safe developer trace for this response.",
    )


class VisionImageAnalysis(BaseModel):
    """Internal first-pass interpretation of a submitted image."""
    identified_subject: str | None = None
    confidence: str | None = Field(
        None,
        description="Low, medium, or high confidence in the identified subject.",
    )
    visual_summary: str = Field(
        "",
        description="Brief description of what is visible in the image.",
    )
    visible_text: str | None = Field(
        None,
        description="Any visible Korean or English text and translation if applicable.",
    )
    safety_or_weather_cues: str | None = Field(
        None,
        description="Only cues directly visible in the photo, if any.",
    )
    draft_answer: str = Field(
        "",
        description="Vision model's draft answer before final SeoulWalk policy pass.",
    )
    uncertainties: list[str] = Field(
        default_factory=list,
        description="Reasons the image interpretation may be uncertain.",
    )


class VisionChatResponse(BaseModel):
    """Response from POST /chat/vision"""
    reply: str
    session_id: str
    waypoint_id: str | None = None
    action: str | None = None
    action_payload: dict | None = None
    web_search_used: bool = False
    identified_subject: str | None = Field(
        None,
        description="Best guess at what was identified in the photo (e.g. 'Geunjeongjeon Throne Hall')",
    )
    debug_trace: dict | None = None
    developer_trace: dict | None = None


# ---------------------------------------------------------------------------
# Voice
# ---------------------------------------------------------------------------

class VoiceTranscribeResponse(BaseModel):
    """Response from POST /voice/transcribe"""
    transcript: str
    provider: str
    session_id: str
    duration_ms: int


class VoiceSynthesizeRequest(BaseModel):
    """Request body for POST /voice/synthesize"""
    text: str = Field(
        ...,
        min_length=1,
        max_length=2400,
        description="Assistant text to synthesize into speech.",
    )
    session_id: str | None = Field(
        None,
        description="Existing session ID to attach synthesis trace events to.",
    )
    model: str | None = Field(
        None,
        description="Optional Deepgram Aura model override.",
    )


class VoiceSynthesizeResponse(BaseModel):
    """Response from POST /voice/synthesize"""
    provider: str
    model: str
    session_id: str
    audio_url: str
    mime_type: str = "audio/mpeg"
    duration_ms: int


class VoiceStreamTicketRequest(BaseModel):
    """Request body for POST /voice/stream-ticket — validates text and returns a one-time stream URL."""
    text: str = Field(
        ...,
        min_length=1,
        max_length=2400,
        description="Assistant text to synthesize into speech.",
    )
    session_id: str | None = Field(
        None,
        description="Existing session ID to attach synthesis trace events to.",
    )
    model: str | None = Field(
        None,
        description="Optional Deepgram Aura model override.",
    )


class VoiceStreamTicketResponse(BaseModel):
    """Response from POST /voice/stream-ticket"""
    provider: str
    model: str
    session_id: str
    stream_url: str = Field(
        ...,
        description="Absolute URL to GET /voice/stream/{ticket_id} — valid for one use within 30 s.",
    )
    expires_in_seconds: int = 30


class VoiceDeepgramTokenRequest(BaseModel):
    """Request body for POST /voice/deepgram-token"""
    session_id: str | None = Field(
        None,
        description="Existing session ID to attach token trace events to.",
    )
    model: str | None = Field(
        None,
        description="Optional Deepgram Aura model override the client plans to use.",
    )


class VoiceDeepgramTokenResponse(BaseModel):
    """Response from POST /voice/deepgram-token"""
    provider: str = "deepgram"
    model: str
    session_id: str
    access_token: str
    expires_in_seconds: int = 30
    speak_url: str = "https://api.deepgram.com/v1/speak"


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


class TraceEventRequest(BaseModel):
    """Request body for POST /activity/trace"""
    session_id: str | None = Field(
        None,
        description="Session ID to attach the trace event to. If omitted, the server creates one.",
    )
    event_type: str = Field(
        ...,
        description="Stable event name, e.g. waypoint_context_attached.",
    )
    event_payload: dict = Field(
        default_factory=dict,
        description="Small JSON metadata payload. Do not include large blobs.",
    )
    source: str = Field(
        "frontend",
        description="Event producer, usually frontend or backend.",
    )


class TraceEventResponse(BaseModel):
    """Response from POST /activity/trace"""
    status: str = "logged"
    session_id: str


# ---------------------------------------------------------------------------
# Session / Health
# ---------------------------------------------------------------------------

class SessionResponse(BaseModel):
    session_id: str
    created_at: str


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.3.0"
