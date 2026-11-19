from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.utils.ffmpeg import ffmpeg_available

router = APIRouter()


def _whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "ffmpeg_available": ffmpeg_available(),
        "faster_whisper_available": _whisper_available(),
        "device": settings.device,
        "compute_type": settings.compute_type,
    }
