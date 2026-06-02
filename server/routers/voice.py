"""
voice.py — speech-to-text support for push-to-talk mobile voice mode.
"""

from __future__ import annotations

import asyncio
import os
import re
import time
import uuid

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from server.config import ASSEMBLYAI_API_KEY, DEEPGRAM_API_KEY, DEEPGRAM_TTS_MODEL_ID
from server.database import create_session, get_session, save_trace_event
from server.models import (
    VoiceSynthesizeRequest,
    VoiceSynthesizeResponse,
    VoiceStreamTicketRequest,
    VoiceStreamTicketResponse,
    VoiceTranscribeResponse,
)
from server.services.langsmith_tracing import traceable

router = APIRouter(prefix="/voice", tags=["Voice"])

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_VOICE_ARTIFACT_DIR = os.path.join(_PROJECT_ROOT, "data", "voice_artifacts")
_SAFE_PATH_RE = re.compile(r"[^A-Za-z0-9_.-]+")

# ---------------------------------------------------------------------------
# Stream-ticket store — in-process, keyed by ticket UUID
# Each entry: {"text": str, "model": str, "session_id": str, "expires_at": float}
# ---------------------------------------------------------------------------
_STREAM_TICKETS: dict[str, dict] = {}
_TICKET_TTL_S: float = 30.0


def _purge_expired_tickets() -> None:
    """Remove tickets that have passed their expiry time."""
    now = time.monotonic()
    expired = [k for k, v in _STREAM_TICKETS.items() if v["expires_at"] < now]
    for k in expired:
        del _STREAM_TICKETS[k]


def _safe_path_part(value: str) -> str:
    return _SAFE_PATH_RE.sub("_", value).strip("._") or "session"


async def _trace_voice_event(session_id: str, event_type: str, payload: dict | None = None) -> None:
    try:
        await save_trace_event(
            session_id=session_id,
            event_type=event_type,
            event_payload=payload or {},
            source="backend",
        )
    except Exception as exc:
        print(f"⚠️ Failed to save voice trace event {event_type}: {exc}")


async def _transcribe_with_deepgram(audio: bytes, mime_type: str) -> str:
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("Missing DEEPGRAM_API_KEY")

    params = {
        "model": "nova-2",
        "smart_format": "true",
        "punctuate": "true",
        "language": "en",
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/listen",
            params=params,
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": mime_type or "audio/m4a",
            },
            content=audio,
        )

    if resp.status_code != 200:
        raise RuntimeError(f"Deepgram returned {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    transcript = (
        data.get("results", {})
        .get("channels", [{}])[0]
        .get("alternatives", [{}])[0]
        .get("transcript", "")
        .strip()
    )
    if not transcript:
        raise RuntimeError("Deepgram returned an empty transcript")
    return transcript


async def _transcribe_with_assemblyai(audio: bytes) -> str:
    if not ASSEMBLYAI_API_KEY:
        raise RuntimeError("Missing ASSEMBLYAI_API_KEY")

    headers = {"Authorization": ASSEMBLYAI_API_KEY}
    async with httpx.AsyncClient(timeout=45.0) as client:
        upload_resp = await client.post(
            "https://api.assemblyai.com/v2/upload",
            headers=headers,
            content=audio,
        )
        if upload_resp.status_code >= 300:
            raise RuntimeError(f"AssemblyAI upload returned {upload_resp.status_code}: {upload_resp.text[:200]}")

        audio_url = upload_resp.json().get("upload_url")
        transcript_resp = await client.post(
            "https://api.assemblyai.com/v2/transcript",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "audio_url": audio_url,
                "speech_model": "universal",
            },
        )
        if transcript_resp.status_code >= 300:
            raise RuntimeError(
                f"AssemblyAI transcript returned {transcript_resp.status_code}: {transcript_resp.text[:200]}"
            )

        transcript_id = transcript_resp.json().get("id")
        for _ in range(30):
            status_resp = await client.get(
                f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                headers=headers,
            )
            if status_resp.status_code >= 300:
                raise RuntimeError(f"AssemblyAI poll returned {status_resp.status_code}: {status_resp.text[:200]}")

            payload = status_resp.json()
            status = payload.get("status")
            if status == "completed":
                transcript = (payload.get("text") or "").strip()
                if not transcript:
                    raise RuntimeError("AssemblyAI returned an empty transcript")
                return transcript
            if status == "error":
                raise RuntimeError(payload.get("error") or "AssemblyAI transcription failed")
            await asyncio.sleep(1.0)

    raise RuntimeError("AssemblyAI transcription timed out")


async def _synthesize_with_deepgram(text: str, model: str) -> bytes:
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("Missing DEEPGRAM_API_KEY")

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/speak",
            params={
                "model": model,
                "encoding": "mp3",
            },
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={"text": text},
        )

    if resp.status_code != 200:
        raise RuntimeError(f"Deepgram TTS returned {resp.status_code}: {resp.text[:200]}")
    if not resp.content:
        raise RuntimeError("Deepgram TTS returned empty audio")
    return resp.content


async def _stream_deepgram_audio(text: str, model: str):
    """Async generator that yields audio bytes from Deepgram as they arrive."""
    if not DEEPGRAM_API_KEY:
        raise RuntimeError("Missing DEEPGRAM_API_KEY")

    started_at = time.perf_counter()
    first_byte_logged = False
    total_bytes = 0

    async with httpx.AsyncClient(timeout=45.0) as client:
        async with client.stream(
            "POST",
            "https://api.deepgram.com/v1/speak",
            params={"model": model, "encoding": "mp3"},
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={"text": text},
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise RuntimeError(f"Deepgram TTS stream returned {resp.status_code}: {body[:200]}")

            async for chunk in resp.aiter_bytes(chunk_size=4096):
                if chunk:
                    if not first_byte_logged:
                        first_byte_ms = round((time.perf_counter() - started_at) * 1000)
                        print(f"🔊 Deepgram TTS first byte in {first_byte_ms} ms")
                        first_byte_logged = True
                    total_bytes += len(chunk)
                    yield chunk

    total_ms = round((time.perf_counter() - started_at) * 1000)
    print(f"🔊 Deepgram TTS stream complete: {total_bytes} bytes in {total_ms} ms")


def _write_voice_artifact(session_id: str, audio: bytes) -> tuple[str, str]:
    safe_session_id = _safe_path_part(session_id)
    filename = f"{uuid.uuid4().hex}.mp3"
    session_dir = os.path.join(_VOICE_ARTIFACT_DIR, safe_session_id)
    os.makedirs(session_dir, exist_ok=True)
    path = os.path.join(session_dir, filename)
    with open(path, "wb") as f:
        f.write(audio)
    return path, f"/voice/audio/{safe_session_id}/{filename}"


@router.post("/transcribe", response_model=VoiceTranscribeResponse)
@traceable(name="Voice Transcribe API", run_type="chain")
async def transcribe_voice(
    audio: UploadFile = File(...),
    session_id: str | None = Form(None),
):
    """Transcribe one push-to-talk audio recording."""
    started_at = time.perf_counter()
    next_session_id = session_id or str(uuid.uuid4())
    if not await get_session(next_session_id):
        await create_session(next_session_id, location="Gwanghwamun")

    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/m4a"
    await _trace_voice_event(
        next_session_id,
        "voice_transcription_started",
        {
            "filename": audio.filename,
            "mime_type": mime_type,
            "size_bytes": len(audio_bytes),
        },
    )

    errors: list[str] = []
    for provider, transcriber in (
        ("deepgram", lambda: _transcribe_with_deepgram(audio_bytes, mime_type)),
        ("assemblyai", lambda: _transcribe_with_assemblyai(audio_bytes)),
    ):
        try:
            transcript = await transcriber()
            duration_ms = round((time.perf_counter() - started_at) * 1000)
            await _trace_voice_event(
                next_session_id,
                "voice_transcription_completed",
                {
                    "provider": provider,
                    "duration_ms": duration_ms,
                    "transcript_length": len(transcript),
                },
            )
            return VoiceTranscribeResponse(
                transcript=transcript,
                provider=provider,
                session_id=next_session_id,
                duration_ms=duration_ms,
            )
        except Exception as exc:
            errors.append(f"{provider}: {exc}")

    duration_ms = round((time.perf_counter() - started_at) * 1000)
    await _trace_voice_event(
        next_session_id,
        "voice_transcription_failed",
        {
            "duration_ms": duration_ms,
            "errors": errors,
        },
    )
    raise HTTPException(
        status_code=502,
        detail="Voice transcription failed. " + " | ".join(errors),
    )


@router.post("/synthesize", response_model=VoiceSynthesizeResponse)
@traceable(name="Voice Synthesize API", run_type="chain")
async def synthesize_voice(req: VoiceSynthesizeRequest):
    """Generate neural TTS audio for one assistant reply."""
    started_at = time.perf_counter()
    next_session_id = req.session_id or str(uuid.uuid4())
    if not await get_session(next_session_id):
        await create_session(next_session_id, location="Gwanghwamun")

    text = req.text.strip()
    model = req.model or DEEPGRAM_TTS_MODEL_ID
    await _trace_voice_event(
        next_session_id,
        "voice_synthesis_started",
        {
            "provider": "deepgram",
            "model": model,
            "text_length": len(text),
        },
    )

    try:
        audio = await _synthesize_with_deepgram(text, model)
        _, audio_url = _write_voice_artifact(next_session_id, audio)
        duration_ms = round((time.perf_counter() - started_at) * 1000)
        await _trace_voice_event(
            next_session_id,
            "voice_synthesis_completed",
            {
                "provider": "deepgram",
                "model": model,
                "duration_ms": duration_ms,
                "text_length": len(text),
                "size_bytes": len(audio),
            },
        )
        return VoiceSynthesizeResponse(
            provider="deepgram",
            model=model,
            session_id=next_session_id,
            audio_url=audio_url,
            duration_ms=duration_ms,
        )
    except Exception as exc:
        duration_ms = round((time.perf_counter() - started_at) * 1000)
        await _trace_voice_event(
            next_session_id,
            "voice_synthesis_failed",
            {
                "provider": "deepgram",
                "model": model,
                "duration_ms": duration_ms,
                "error": str(exc),
            },
        )
        raise HTTPException(
            status_code=502,
            detail=f"Voice synthesis failed. {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# POST /voice/stream-ticket — issue a one-time stream URL
# ---------------------------------------------------------------------------

@router.post("/stream-ticket", response_model=VoiceStreamTicketResponse)
async def create_stream_ticket(req: VoiceStreamTicketRequest):
    """Validate text and return a short-lived URL for streaming TTS audio."""
    next_session_id = req.session_id or str(uuid.uuid4())
    if not await get_session(next_session_id):
        await create_session(next_session_id, location="Gwanghwamun")

    text = req.text.strip()
    model = req.model or DEEPGRAM_TTS_MODEL_ID

    _purge_expired_tickets()
    ticket_id = uuid.uuid4().hex
    _STREAM_TICKETS[ticket_id] = {
        "text": text,
        "model": model,
        "session_id": next_session_id,
        "expires_at": time.monotonic() + _TICKET_TTL_S,
    }

    await _trace_voice_event(
        next_session_id,
        "voice_stream_ticket_created",
        {
            "provider": "deepgram",
            "model": model,
            "text_length": len(text),
            "ticket_id": ticket_id,
        },
    )

    return VoiceStreamTicketResponse(
        provider="deepgram",
        model=model,
        session_id=next_session_id,
        stream_url=f"/voice/stream/{ticket_id}",
        expires_in_seconds=int(_TICKET_TTL_S),
    )


# ---------------------------------------------------------------------------
# GET /voice/stream/{ticket_id} — stream audio bytes directly from Deepgram
# ---------------------------------------------------------------------------

@router.get("/stream/{ticket_id}")
async def stream_voice_audio(ticket_id: str):
    """Consume a stream ticket and proxy Deepgram TTS audio bytes to the client."""
    _purge_expired_tickets()
    ticket = _STREAM_TICKETS.pop(ticket_id, None)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Stream ticket not found or expired")
    if ticket["expires_at"] < time.monotonic():
        raise HTTPException(status_code=410, detail="Stream ticket expired")

    text = ticket["text"]
    model = ticket["model"]
    session_id = ticket["session_id"]
    started_at = time.perf_counter()

    await _trace_voice_event(
        session_id,
        "voice_stream_started",
        {
            "provider": "deepgram",
            "model": model,
            "text_length": len(text),
            "ticket_id": ticket_id,
        },
    )

    async def audio_generator():
        total_bytes = 0
        first_byte = True
        try:
            async for chunk in _stream_deepgram_audio(text, model):
                if first_byte:
                    first_ms = round((time.perf_counter() - started_at) * 1000)
                    await _trace_voice_event(
                        session_id,
                        "voice_stream_first_byte",
                        {"provider": "deepgram", "model": model, "first_byte_ms": first_ms},
                    )
                    first_byte = False
                total_bytes += len(chunk)
                yield chunk
        except Exception as exc:
            duration_ms = round((time.perf_counter() - started_at) * 1000)
            await _trace_voice_event(
                session_id,
                "voice_stream_failed",
                {
                    "provider": "deepgram",
                    "model": model,
                    "duration_ms": duration_ms,
                    "error": str(exc),
                },
            )
            return

        duration_ms = round((time.perf_counter() - started_at) * 1000)
        await _trace_voice_event(
            session_id,
            "voice_stream_completed",
            {
                "provider": "deepgram",
                "model": model,
                "duration_ms": duration_ms,
                "size_bytes": total_bytes,
            },
        )

    return StreamingResponse(
        audio_generator(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache, no-store",
            "X-Accel-Buffering": "no",
            "Content-Disposition": "inline",
        },
    )


@router.get("/audio/{session_id}/{filename}")
async def get_voice_audio(session_id: str, filename: str):
    safe_session_id = _safe_path_part(session_id)
    safe_filename = _safe_path_part(filename)
    if safe_filename != filename or not safe_filename.endswith(".mp3"):
        raise HTTPException(status_code=404, detail="Audio not found")

    path = os.path.join(_VOICE_ARTIFACT_DIR, safe_session_id, safe_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio not found")

    return FileResponse(
        path,
        media_type="audio/mpeg",
        filename=safe_filename,
    )
