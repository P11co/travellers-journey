"""
test_config.py — Tests for API key environment precedence.
"""

import importlib


def test_deepgram_server_key_preferred_over_public_key(monkeypatch):
    """Backend Deepgram calls should use the server key when both keys exist."""
    import server.config as config

    monkeypatch.setenv("DEEPGRAM_API_KEY", "server-member-key")
    monkeypatch.setenv("EXPO_PUBLIC_DEEPGRAM_API_KEY", "public-client-key")

    reloaded = importlib.reload(config)
    assert reloaded.DEEPGRAM_API_KEY == "server-member-key"


def test_naver_local_search_credentials_are_separate(monkeypatch):
    """Naver Local Search can use Naver Developers keys independently of Maps."""
    import server.config as config

    monkeypatch.setenv("NAVER_MAP_CLIENT_ID", "map-id")
    monkeypatch.setenv("NAVER_MAP_CLIENT_SECRET", "map-secret")
    monkeypatch.setenv("NAVER_LOCAL_CLIENT_ID", "local-id")
    monkeypatch.setenv("NAVER_LOCAL_CLIENT_SECRET", "local-secret")

    reloaded = importlib.reload(config)
    assert reloaded.NAVER_MAP_CLIENT_ID == "map-id"
    assert reloaded.NAVER_MAP_CLIENT_SECRET == "map-secret"
    assert reloaded.NAVER_LOCAL_CLIENT_ID == "local-id"
    assert reloaded.NAVER_LOCAL_CLIENT_SECRET == "local-secret"
