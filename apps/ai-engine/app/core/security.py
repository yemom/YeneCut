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

WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}

_MEDIA_ROOT: Path | None = (
    Path(os.environ["YENECUT_MEDIA_ROOT"]).resolve()
    if "YENECUT_MEDIA_ROOT" in os.environ else None
)


def _reject_symlink_or_junction(raw_path: Path, label: str) -> None:
    path_str = str(raw_path)
    normalized = path_str.replace("/", "\\")

    # Reject device namespaces and extended prefixes (\\.\, \\?\, \\?\UNC\)
    if normalized.startswith("\\\\.\\") or normalized.startswith("\\\\?\\"):
        raise SecurityError(f"{label}: device and extended paths are not allowed: {raw_path}")

    # Reject remote UNC network paths to prevent Windows SMB credential leaks / NTLM relay
    if normalized.startswith("\\\\"):
        raise SecurityError(f"{label}: UNC network paths are not allowed: {raw_path}")

    # Reject Windows reserved device names (CON, NUL, AUX, PRN, COM1-9, LPT1-9)
    for part in raw_path.parts:
        clean_part = part.rstrip(" .")
        base_name = clean_part.split(".")[0].upper()
        if base_name in WINDOWS_RESERVED_NAMES:
            raise SecurityError(f"{label}: path contains Windows reserved device name '{part}': {raw_path}")

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


def _validate_font_signature(path: Path) -> None:
    header = path.read_bytes()[:12]
    suffix = path.suffix.lower()
    if suffix in {".ttf"} and not header.startswith(b"\x00\x01\x00\x00"):
        raise SecurityError(f"invalid TrueType font signature: {path}")
    if suffix == ".otf" and not header.startswith(b"OTTO"):
        raise SecurityError(f"invalid OpenType font signature: {path}")
    if suffix == ".woff" and not header.startswith(b"wOFF"):
        raise SecurityError(f"invalid WOFF font signature: {path}")
    if suffix == ".woff2" and not header.startswith(b"wOF2"):
        raise SecurityError(f"invalid WOFF2 font signature: {path}")
    if suffix == ".ttc" and not header.startswith(b"ttcf"):
        raise SecurityError(f"invalid TrueType collection signature: {path}")


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
    _validate_font_signature(path)
    return path


def _validate_media_signature(path: Path) -> None:
    header = path.read_bytes()[:32]
    suffix = path.suffix.lower()
    if suffix == ".wav" and not (header.startswith(b"RIFF") and header[8:12] == b"WAVE"):
        raise SecurityError(f"invalid WAV file signature: {path}")
    if suffix == ".mp3" and not (header.startswith(b"ID3") or header[:2] == b"\xff\xfb"):
        raise SecurityError(f"invalid MP3 file signature: {path}")
    if suffix == ".flac" and not header.startswith(b"fLaC"):
        raise SecurityError(f"invalid FLAC file signature: {path}")
    if suffix == ".ogg" and not header.startswith(b"OggS"):
        raise SecurityError(f"invalid OGG file signature: {path}")
    if suffix in {".mp4", ".mov", ".m4a"} and header[4:8] != b"ftyp":
        raise SecurityError(f"invalid MP4/MOV file signature: {path}")
    if suffix == ".mkv" and header[:4] != b"\x1aE\xdf\xa3":
        raise SecurityError(f"invalid Matroska file signature: {path}")
    if suffix == ".avi" and not (header.startswith(b"RIFF") and header[8:12] == b"AVI "):
        raise SecurityError(f"invalid AVI file signature: {path}")
    if suffix == ".mxf" and header[:4] != b"\x06\x0e\x2b\x34":
        raise SecurityError(f"invalid MXF file signature: {path}")


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
    _validate_media_signature(path)
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
