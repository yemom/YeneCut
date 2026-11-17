from __future__ import annotations

import hashlib
import hmac
import os
from pathlib import Path

from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from app.config import settings
from app.core.exceptions import SecurityError

api_key_header = APIKeyHeader(name="X-YeneCut-Token", auto_error=False)


def verify_token(token: str | None = Security(api_key_header)) -> str:
    if token is None or not hmac.compare_digest(token, settings.token):
        raise HTTPException(status_code=401, detail="Invalid or missing engine token")
    return token


ALLOWED_MEDIA_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".mp4", ".mov", ".mkv",
    ".avi", ".mxf", ".prproj",
}
ALLOWED_OUTPUT_EXTENSIONS = {".wav", ".srt", ".vtt", ".ass", ".json", ".txt"}


def validate_source_path(source_path: str, max_bytes: int) -> Path:
    if not source_path:
        raise SecurityError("source_path is required")
    path = Path(source_path).expanduser().resolve()
    if not path.is_absolute():
        raise SecurityError("source_path must be absolute")
    if not path.exists() or not path.is_file():
        raise SecurityError(f"source file does not exist: {path}")
    if path.suffix.lower() not in ALLOWED_MEDIA_EXTENSIONS:
        raise SecurityError(f"unsupported media extension: {path.suffix}")
    size = path.stat().st_size
    if size <= 0 or size > max_bytes:
        raise SecurityError(f"source file size is outside allowed range: {size}")
    # Prevent path traversal by ensuring resolved path is not suspicious.
    if ".." in path.parts:
        raise SecurityError("path traversal is not allowed")
    return path


def validate_output_path(output_path: str) -> Path:
    path = Path(output_path).expanduser().resolve()
    if path.suffix.lower() not in ALLOWED_OUTPUT_EXTENSIONS:
        raise SecurityError(f"unsupported output extension: {path.suffix}")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def sanitize_filename(name: str) -> str:
    return "".join(ch for ch in name if ch.isalnum() or ch in "._-").strip("._-") or "output"
