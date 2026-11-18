from __future__ import annotations

import hashlib
import hmac
import logging
import os
from pathlib import Path

from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from app.config import settings
from app.core.exceptions import SecurityError

logger = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="X-YeneCut-Token", auto_error=False)


def verify_token(token: str | None = Security(api_key_header)) -> str:
    if token is None or not hmac.compare_digest(token, settings.token):
        raise HTTPException(status_code=401, detail="Invalid or missing engine token")
    return token


ALLOWED_MEDIA_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg",
    ".mp4", ".mov", ".mkv", ".avi", ".mxf",
}
ALLOWED_FONT_EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2", ".ttc"}
ALLOWED_OUTPUT_EXTENSIONS = {".wav", ".srt", ".vtt", ".ass", ".json", ".txt"}

_MEDIA_ROOT: Path | None = (
    Path(os.environ["YENECUT_MEDIA_ROOT"]).resolve()
    if "YENECUT_MEDIA_ROOT" in os.environ else None
)


def _reject_symlink_or_junction(raw_path: Path, label: str) -> None:
    # Reject remote UNC network paths to prevent Windows SMB credential leaks / NTLM relay
    path_str = str(raw_path)
    if path_str.startswith(r"\\") or path_str.startswith("//"):
        raise SecurityError(f"{label}: UNC network paths are not allowed: {raw_path}")

    lexical = os.path.abspath(str(raw_path))
    try:
        real = os.path.realpath(str(raw_path))
    except OSError as exc:
        raise SecurityError(f"{label}: unable to resolve path: {exc}") from exc
    if lexical != real:
        raise SecurityError(f"{label}: symlink or junction is not allowed: {raw_path}")
    if _MEDIA_ROOT is not None:
        try:
            Path(real).relative_to(_MEDIA_ROOT)
        except ValueError as exc:
            raise SecurityError(
                f"{label}: path is outside the allowed media root ({_MEDIA_ROOT}): {raw_path}"
            ) from exc


def _assert_no_symlink_escape(path: Path, label: str) -> None:
    _reject_symlink_or_junction(path, label)


def validate_font_path(font_path: str, max_bytes: int = 50 * 1024 * 1024) -> Path:
    if not font_path:
        raise SecurityError("font_path is required")
    raw_path = Path(font_path).expanduser()
    if not raw_path.is_absolute():
        raise SecurityError("font_path must be absolute")
    _reject_symlink_or_junction(raw_path, "font_path")
    path = raw_path.resolve()
    if not path.exists() or not path.is_file():
        raise SecurityError(f"font file does not exist: {path}")
    if path.suffix.lower() not in ALLOWED_FONT_EXTENSIONS:
        raise SecurityError(f"unsupported font extension: {path.suffix}")
    size = path.stat().st_size
    if size <= 0 or size > max_bytes:
        raise SecurityError(f"font file size is outside allowed range: {size}")
    return path


def validate_source_path(source_path: str, max_bytes: int) -> Path:
    if not source_path:
        raise SecurityError("source_path is required")
    raw_path = Path(source_path).expanduser()
    if not raw_path.is_absolute():
        raise SecurityError("source_path must be absolute")
    _reject_symlink_or_junction(raw_path, "source_path")
    path = raw_path.resolve()
    if not path.exists() or not path.is_file():
        raise SecurityError(f"source file does not exist: {path}")
    if path.suffix.lower() not in ALLOWED_MEDIA_EXTENSIONS:
        raise SecurityError(f"unsupported media extension: {path.suffix}")
    size = path.stat().st_size
    if size <= 0 or size > max_bytes:
        raise SecurityError(f"source file size is outside allowed range: {size}")
    return path


def validate_output_path(output_path: str) -> Path:
    raw_path = Path(output_path).expanduser()
    _reject_symlink_or_junction(raw_path, "output_path")
    path = raw_path.resolve()
    if path.suffix.lower() not in ALLOWED_OUTPUT_EXTENSIONS:
        raise SecurityError(f"unsupported output extension: {path.suffix}")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def sanitize_filename(name: str) -> str:
    return "".join(ch for ch in name if ch.isalnum() or ch in "._-").strip("._-") or "output"
