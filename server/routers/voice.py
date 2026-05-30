"""
voice.py — speech-to-text support for push-to-talk mobile voice mode.
"""

from __future__ import annotations

import asyncio
import time
import uuid

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from server.config import ASSEMBLYAI_API_KEY, DEEPGRAM_API_KEY
from server.database import create_session, get_session, save_trace_event
from server.models import VoiceTranscribeResponse
from server.services.langsmith_tracing import traceable

router = APIRouter(prefix="/voice", tags=["Voice"])


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
