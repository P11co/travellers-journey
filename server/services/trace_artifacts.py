"""
Local trace artifact storage.

LangSmith traces should reference image files instead of embedding large base64
payloads. This module writes those images under data/trace_artifacts and
returns compact metadata that can be included in debug traces.
"""

from __future__ import annotations

import base64
import os
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


_PROJECT_ROOT = Path(__file__).resolve().parents[2]
TRACE_ARTIFACT_ROOT = _PROJECT_ROOT / "data" / "trace_artifacts"
_SAFE_SEGMENT_RE = re.compile(r"[^A-Za-z0-9_.-]+")
_MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def _safe_segment(value: str | None, fallback: str) -> str:
    cleaned = _SAFE_SEGMENT_RE.sub("-", value or "").strip("-._")
    return cleaned[:80] or fallback


def save_base64_image_artifact(
    *,
    image_base64: str | None,
    session_id: str,
    label: str,
    mime_type: str = "image/png",
    metadata: dict | None = None,
) -> dict | None:
    """
    Decode a base64 image and write it to data/trace_artifacts/<session_id>/.

    Returns relative and absolute paths plus compact metadata. If decoding or
    writing fails, returns a small error object instead of breaking the request.
    """
    if not image_base64:
        return None

    safe_session = _safe_segment(session_id, "unknown-session")
    safe_label = _safe_segment(label, "image")
    extension = _MIME_EXTENSIONS.get(mime_type.lower(), "bin")
    timestamp = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%dT%H%M%S%f")
    artifact_dir = TRACE_ARTIFACT_ROOT / safe_session
    artifact_path = artifact_dir / f"{timestamp}-{safe_label}.{extension}"

    try:
        raw = base64.b64decode(image_base64, validate=False)
        artifact_dir.mkdir(parents=True, exist_ok=True)
        artifact_path.write_bytes(raw)
    except Exception as exc:
        return {
            "saved": False,
            "error": str(exc),
            "mime_type": mime_type,
            "base64_chars": len(image_base64),
            **(metadata or {}),
        }

    return {
        "saved": True,
        "path": os.path.relpath(artifact_path, _PROJECT_ROOT),
        "absolute_path": str(artifact_path),
        "mime_type": mime_type,
        "size_bytes": len(raw),
        "base64_chars": len(image_base64),
        **(metadata or {}),
    }
