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

# Optional: restrict media to a specific directory tree (set via env or config)
_MEDIA_ROOT: Path | None = (
    Path(os.environ["YENECUT_MEDIA_ROOT"]).resolve()
    if "YENECUT_MEDIA_ROOT" in os.environ else None
)


def _assert_no_symlink_escape(path: Path, label: str) -> None:
    """
    Reject paths that resolve to a different location via symlink or junction.
    path.resolve() already collapses '..' components, so we confirm the
    final resolved path matches what realpath gives us.
    After .resolve() the path contains no '..' components — checking for them
    in .parts would always be False and is therefore NOT a valid traversal check.
    Instead we detect symlink-based escapes by comparing resolve() outputs.
    """
    try:
        real = Path(os.path.realpath(path))
        if real != path:
            raise SecurityError(
                f"{label}: symlink or junction would escape to a different path: "
                f"resolved={path}, realpath={real}"
            )
    except OSError:
        pass  # path may not exist yet (e.g. output paths)

    if _MEDIA_ROOT is not None:
        try:
            path.relative_to(_MEDIA_ROOT)
        except ValueError:
            raise SecurityError(
                f"{label}: path is outside the allowed media root "
                f"({_MEDIA_ROOT}): {path}"
            )


def validate_font_path(font_path: str, max_bytes: int = 50 * 1024 * 1024) -> Path:
    if not font_path:
        raise SecurityError("font_path is required")
    path = Path(font_path).expanduser().resolve()
    if not path.is_absolute():
        raise SecurityError("font_path must be absolute")
    if not path.exists() or not path.is_file():
        raise SecurityError(f"font file does not exist: {path}")
    if path.suffix.lower() not in ALLOWED_FONT_EXTENSIONS:
        raise SecurityError(f"unsupported font extension: {path.suffix}")
    size = path.stat().st_size
    if size <= 0 or size > max_bytes:
        raise SecurityError(f"font file size is outside allowed range: {size}")
    _assert_no_symlink_escape(path, "font_path")
    return path


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
    _assert_no_symlink_escape(path, "source_path")
    return path


def validate_output_path(output_path: str) -> Path:
    path = Path(output_path).expanduser().resolve()
    if path.suffix.lower() not in ALLOWED_OUTPUT_EXTENSIONS:
        raise SecurityError(f"unsupported output extension: {path.suffix}")
    # Do NOT follow symlinks for output — only create under the resolved parent
    _assert_no_symlink_escape(path, "output_path")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def sanitize_filename(name: str) -> str:
    return "".join(ch for ch in name if ch.isalnum() or ch in "._-").strip("._-") or "output"

