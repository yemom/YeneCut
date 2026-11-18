from __future__ import annotations

import json
from pathlib import Path

from app.core.exceptions import ValidationError
from app.core.security import validate_font_path
from app.schemas.models import FontValidationRequest, FontValidationResponse

FONT_LIBRARY_PATH = Path(__file__).resolve().parents[1] / "storage" / "fonts.json"


def load_font_library() -> list[dict]:
    with FONT_LIBRARY_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_font(request: FontValidationRequest, max_bytes: int) -> FontValidationResponse:
    if request.font_path:
        try:
            path = validate_font_path(request.font_path, max_bytes)
        except Exception as exc:
            return FontValidationResponse(
                available=False,
                family=request.family or path.stem if False else (request.family or "unknown"),
                path=request.font_path,
                message=str(exc),
            )
        family = request.family or path.stem
        return FontValidationResponse(available=True, family=family, path=str(path), message="Font file is readable")
    if request.family:
        installed = font_family_installed(request.family)
        return FontValidationResponse(
            available=installed,
            family=request.family,
            path=None,
            message="Font is available to the system" if installed else "Font is not installed on this system",
        )
    raise ValidationError("font_path or family is required")


def font_family_installed(family: str) -> bool:
    # Best-effort system font check. Premiere rendering availability must be
    # verified separately in the host application.
    system_font_dirs = [
        Path("C:/Windows/Fonts"),
        Path.home() / "AppData" / "Local" / "Microsoft" / "Windows" / "Fonts",
    ]
    lowered = family.lower().replace(" ", "")
    for directory in system_font_dirs:
        if not directory.exists():
            continue
        for path in directory.rglob("*"):
            if path.is_file() and lowered in path.stem.lower().replace(" ", ""):
                return True
    return False
