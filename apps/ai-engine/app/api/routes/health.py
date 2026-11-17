from __future__ import annotations

from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "ffmpeg_available": __import__("app.utils.ffmpeg", fromlist=["ffmpeg_available"]).ffmpeg_available(),
    }
