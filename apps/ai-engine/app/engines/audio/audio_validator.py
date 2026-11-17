from __future__ import annotations

from pathlib import Path

from app.core.security import validate_source_path


def validate_source(source_path: str, max_bytes: int) -> Path:
    return validate_source_path(source_path, max_bytes)
