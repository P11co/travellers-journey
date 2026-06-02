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
async def test_assemblyai_uses_current_speech_models(monkeypatch):
    """AssemblyAI fallback uses the current speech_models field, not deprecated speech_model."""
    import server.routers.voice as voice_module

    class FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload
            self.text = str(payload)

        def json(self):
            return self._payload

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, headers=None, content=None, json=None):
            if url.endswith("/upload"):
                return FakeResponse(200, {"upload_url": "https://audio.example/file.m4a"})
            assert url.endswith("/transcript")
            assert "speech_model" not in json
            assert json["speech_models"] == ["universal-3-pro", "universal-2"]
            return FakeResponse(200, {"id": "transcript-id"})

        async def get(self, url, headers=None):
            return FakeResponse(200, {"status": "completed", "text": "Hello SeoulWalk."})

    monkeypatch.setattr(voice_module, "ASSEMBLYAI_API_KEY", "assembly-key")
    monkeypatch.setattr(voice_module.httpx, "AsyncClient", lambda timeout=45.0: FakeClient())

    transcript = await voice_module._transcribe_with_assemblyai(b"audio")
    assert transcript == "Hello SeoulWalk."


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


@pytest.mark.asyncio
async def test_voice_deepgram_token_success(client):
    """Backend returns a temporary Deepgram client token without exposing the API key."""
    with patch("server.routers.voice._create_deepgram_access_token", new_callable=AsyncMock) as mock_token:
        mock_token.return_value = {
            "access_token": "temporary-client-token",
            "expires_in": 30,
        }

        resp = await client.post(
            "/voice/deepgram-token",
            json={"session_id": "voice-token-session"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "deepgram"
    assert data["session_id"] == "voice-token-session"
    assert data["model"]
    assert data["access_token"] == "temporary-client-token"
    assert data["expires_in_seconds"] == 30
    assert data["speak_url"] == "https://api.deepgram.com/v1/speak"


@pytest.mark.asyncio
async def test_voice_deepgram_token_failure_returns_502(client):
    """Frontend can fall back when temporary token creation fails."""
    with patch("server.routers.voice._create_deepgram_access_token", new_callable=AsyncMock) as mock_token:
        mock_token.side_effect = RuntimeError("Deepgram token unavailable")

        resp = await client.post(
            "/voice/deepgram-token",
            json={"session_id": "voice-token-fail-session"},
        )

    assert resp.status_code == 502
    assert "Deepgram token grant failed" in resp.json()["detail"]


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
    assert data["stream_url"].endswith(".mp3")
    assert data["expires_in_seconds"] > 0


@pytest.mark.asyncio
async def test_voice_stream_missing_ticket_returns_404(client):
    """GET /voice/stream/<unknown> returns 404."""
    resp = await client.get("/voice/stream/nonexistentticket")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_voice_stream_head_probe_does_not_consume_ticket(client):
    """Native audio players can probe a stream URL with HEAD before GET."""
    import server.routers.voice as voice_module

    async def fake_stream(text, model):
        yield b"audio"

    ticket_resp = await client.post(
        "/voice/stream-ticket",
        json={"text": "Probe me first.", "session_id": "head-probe-session"},
    )
    ticket_path = ticket_resp.json()["stream_url"]

    head_resp = await client.head(ticket_path)
    assert head_resp.status_code == 200
    assert head_resp.headers["content-type"].startswith("audio/mpeg")

    with patch.object(voice_module, "_stream_deepgram_audio", side_effect=fake_stream):
        get_resp = await client.get(ticket_path)
    assert get_resp.status_code == 200
    assert get_resp.content == b"audio"


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
async def test_voice_stream_ticket_allows_repeated_gets_within_ttl(client):
    """Native audio players may retry a stream URL during setup."""
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

    with patch.object(voice_module, "_stream_deepgram_audio", side_effect=fake_stream):
        second = await client.get(ticket_path)
    assert second.status_code == 200
    assert second.content == b"audio"


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
