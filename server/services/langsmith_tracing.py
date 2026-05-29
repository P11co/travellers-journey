"""
Optional LangSmith tracing helpers.

The backend should keep working when LangSmith is not installed or not
configured. The real SDK reads LANGSMITH_TRACING, LANGSMITH_API_KEY, and
LANGSMITH_PROJECT from the environment.
"""

from __future__ import annotations

import re
from collections.abc import Mapping

try:
    from langsmith import traceable as _traceable
except Exception:  # pragma: no cover - intentionally optional dependency
    _traceable = None

try:
    from pydantic import BaseModel
except Exception:  # pragma: no cover - pydantic is present in app runtime
    BaseModel = None


_DATA_URL_RE = re.compile(
    r"data:(?P<mime>[-.\w]+/[-+.\w]+);base64,(?P<payload>[A-Za-z0-9+/=\s]+)"
)
_BASE64_BLOB_RE = re.compile(r"^[A-Za-z0-9+/=\s]+$")
_BASE64_FIELD_NAMES = {
    "image_base64",
    "map_snapshot_b64",
    "base64",
    "b64",
}


def _redact_base64_blob(value: str, label: str = "base64") -> str:
    return f"[{label} omitted: {len(value)} chars]"


def _redact_data_urls(value: str) -> str:
    def replace(match: re.Match) -> str:
        mime = match.group("mime")
        payload = match.group("payload")
        return f"data:{mime};base64,[omitted {len(payload)} chars]"

    return _DATA_URL_RE.sub(replace, value)


def _looks_like_large_base64(value: str) -> bool:
    return len(value) > 512 and bool(_BASE64_BLOB_RE.fullmatch(value))


def sanitize_trace_payload(value, key: str | None = None):
    """
    Remove inline image/base64 payloads from LangSmith inputs and outputs.

    This keeps traces pasteable while preserving enough metadata to understand
    that an image was sent. Actual image files are saved separately by callers
    that have enough session/run context to choose a useful artifact path.
    """
    if BaseModel is not None and isinstance(value, BaseModel):
        return sanitize_trace_payload(value.model_dump(mode="json"), key)

    if isinstance(value, Mapping):
        return {
            item_key: sanitize_trace_payload(item_value, str(item_key))
            for item_key, item_value in value.items()
        }

    if isinstance(value, list):
        return [sanitize_trace_payload(item, key) for item in value]

    if isinstance(value, tuple):
        return tuple(sanitize_trace_payload(item, key) for item in value)

    if isinstance(value, str):
        normalized_key = (key or "").lower()
        if normalized_key in _BASE64_FIELD_NAMES and value:
            return _redact_base64_blob(value, normalized_key)
        redacted = _redact_data_urls(value)
        if redacted != value:
            return redacted
        if _looks_like_large_base64(value):
            return _redact_base64_blob(value)

    return value


def traceable(*args, **kwargs):
    """Return LangSmith's traceable decorator, or a no-op fallback."""
    if _traceable is not None:
        return _traceable(*args, **kwargs)

    if args and callable(args[0]) and len(args) == 1 and not kwargs:
        return args[0]

    def decorator(fn):
        return fn

    return decorator
