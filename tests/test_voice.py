"""
test_voice.py — Tests for the POST /voice/transcribe endpoint.
"""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_voice_transcribe_deepgram_success(client):
    """Voice endpoint returns transcript and provider metadata."""
    with patch("server.routers.voice._transcribe_with_deepgram", new_callable=AsyncMock) as mock_deepgram:
        mock_deepgram.return_value = "Where should we go now?"

        resp = await client.post(
            "/voice/transcribe",
            files={"audio": ("voice.m4a", b"fake-audio-bytes", "audio/m4a")},
            data={"session_id": "voice-session-1"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["transcript"] == "Where should we go now?"
    assert data["provider"] == "deepgram"
    assert data["session_id"] == "voice-session-1"
    assert isinstance(data["duration_ms"], int)


@pytest.mark.asyncio
async def test_voice_transcribe_falls_back_to_assemblyai(client):
    """Voice endpoint uses AssemblyAI if Deepgram fails."""
    with patch("server.routers.voice._transcribe_with_deepgram", new_callable=AsyncMock) as mock_deepgram, \
         patch("server.routers.voice._transcribe_with_assemblyai", new_callable=AsyncMock) as mock_assembly:
        mock_deepgram.side_effect = RuntimeError("Deepgram unavailable")
        mock_assembly.return_value = "Tell me about this gate."

        resp = await client.post(
            "/voice/transcribe",
            files={"audio": ("voice.m4a", b"fake-audio-bytes", "audio/m4a")},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["transcript"] == "Tell me about this gate."
    assert data["provider"] == "assemblyai"
    assert data["session_id"]


@pytest.mark.asyncio
async def test_voice_transcribe_all_providers_fail(client):
    """Voice endpoint returns 502 if no STT provider succeeds."""
    with patch("server.routers.voice._transcribe_with_deepgram", new_callable=AsyncMock) as mock_deepgram, \
         patch("server.routers.voice._transcribe_with_assemblyai", new_callable=AsyncMock) as mock_assembly:
        mock_deepgram.side_effect = RuntimeError("Deepgram unavailable")
        mock_assembly.side_effect = RuntimeError("AssemblyAI unavailable")

        resp = await client.post(
            "/voice/transcribe",
            files={"audio": ("voice.m4a", b"fake-audio-bytes", "audio/m4a")},
        )

    assert resp.status_code == 502
    assert "Voice transcription failed" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_voice_transcribe_missing_audio_returns_422(client):
    """Missing audio file returns 422."""
    resp = await client.post("/voice/transcribe", data={"session_id": "missing-audio"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_voice_synthesize_deepgram_success(client, tmp_path, monkeypatch):
    """Voice synthesis returns a playable audio artifact URL."""
    monkeypatch.setattr("server.routers.voice._VOICE_ARTIFACT_DIR", str(tmp_path))

    with patch("server.routers.voice._synthesize_with_deepgram", new_callable=AsyncMock) as mock_synthesize:
        mock_synthesize.return_value = b"fake-mp3-bytes"

        resp = await client.post(
            "/voice/synthesize",
            json={
                "text": "Voice mode is ready.",
                "session_id": "voice-session-tts",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "deepgram"
    assert data["session_id"] == "voice-session-tts"
    assert data["model"]
    assert data["audio_url"].startswith("/voice/audio/voice-session-tts/")
    assert data["mime_type"] == "audio/mpeg"

    audio_resp = await client.get(data["audio_url"])
    assert audio_resp.status_code == 200
    assert audio_resp.content == b"fake-mp3-bytes"


@pytest.mark.asyncio
async def test_voice_synthesize_deepgram_failure_returns_502(client):
    """Frontend can fall back to system TTS when Deepgram synthesis fails."""
    with patch("server.routers.voice._synthesize_with_deepgram", new_callable=AsyncMock) as mock_synthesize:
        mock_synthesize.side_effect = RuntimeError("Deepgram unavailable")

        resp = await client.post(
            "/voice/synthesize",
            json={"text": "Please speak this."},
        )

    assert resp.status_code == 502
    assert "Voice synthesis failed" in resp.json()["detail"]
