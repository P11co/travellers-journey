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


# ---------------------------------------------------------------------------
# Streaming TTS — additive tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_voice_stream_ticket_returns_stream_url(client):
    """POST /voice/stream-ticket returns a stream URL without touching Deepgram."""
    resp = await client.post(
        "/voice/stream-ticket",
        json={
            "text": "Hello from the streaming path.",
            "session_id": "stream-ticket-session",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "deepgram"
    assert data["session_id"] == "stream-ticket-session"
    assert data["model"]
    assert data["stream_url"].startswith("/voice/stream/")
    assert data["expires_in_seconds"] > 0


@pytest.mark.asyncio
async def test_voice_stream_missing_ticket_returns_404(client):
    """GET /voice/stream/<unknown> returns 404."""
    resp = await client.get("/voice/stream/nonexistentticket")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_voice_stream_audio_yields_chunks(client):
    """GET /voice/stream/<ticket> streams audio bytes from the mocked Deepgram primitive."""
    import server.routers.voice as voice_module

    async def fake_stream(text, model):
        yield b"chunk1"
        yield b"chunk2"
        yield b"chunk3"

    # First obtain a valid ticket.
    ticket_resp = await client.post(
        "/voice/stream-ticket",
        json={"text": "Stream this text.", "session_id": "stream-audio-session"},
    )
    assert ticket_resp.status_code == 200
    ticket_data = ticket_resp.json()
    ticket_path = ticket_data["stream_url"]  # e.g. /voice/stream/<id>

    with patch.object(voice_module, "_stream_deepgram_audio", side_effect=fake_stream):
        stream_resp = await client.get(ticket_path)

    assert stream_resp.status_code == 200
    assert stream_resp.headers["content-type"].startswith("audio/mpeg")
    assert stream_resp.content == b"chunk1chunk2chunk3"


@pytest.mark.asyncio
async def test_voice_stream_ticket_is_single_use(client):
    """A stream ticket can only be consumed once; the second GET returns 404."""
    import server.routers.voice as voice_module

    async def fake_stream(text, model):
        yield b"audio"

    ticket_resp = await client.post(
        "/voice/stream-ticket",
        json={"text": "Use me once.", "session_id": "single-use-session"},
    )
    assert ticket_resp.status_code == 200
    ticket_path = ticket_resp.json()["stream_url"]

    with patch.object(voice_module, "_stream_deepgram_audio", side_effect=fake_stream):
        first = await client.get(ticket_path)
    assert first.status_code == 200

    second = await client.get(ticket_path)
    assert second.status_code == 404


@pytest.mark.asyncio
async def test_voice_stream_no_artifact_file_written(client, tmp_path, monkeypatch):
    """Streaming TTS does not write any MP3 file to the artifact directory."""
    import server.routers.voice as voice_module

    monkeypatch.setattr(voice_module, "_VOICE_ARTIFACT_DIR", str(tmp_path))

    async def fake_stream(text, model):
        yield b"audio-data"

    ticket_resp = await client.post(
        "/voice/stream-ticket",
        json={"text": "No file please.", "session_id": "no-file-session"},
    )
    ticket_path = ticket_resp.json()["stream_url"]

    with patch.object(voice_module, "_stream_deepgram_audio", side_effect=fake_stream):
        await client.get(ticket_path)

    # The artifact directory must remain empty — no MP3 written.
    written_files = list(tmp_path.rglob("*.mp3"))
    assert written_files == [], f"Expected no MP3 files, but found: {written_files}"
