from __future__ import annotations

from fastapi import FastAPI

from app.api.routes import audio, captions, fonts, health, jobs, premiere_transcript, silence, transcription
from app.config import settings

app = FastAPI(title=settings.app_name, version=settings.app_version)

app.include_router(health.router, prefix="/api/v1" if False else "")
# health at /health
app.include_router(health.router)
app.include_router(audio.router, prefix="/api/v1")
app.include_router(silence.router, prefix="/api/v1")
app.include_router(transcription.router, prefix="/api/v1")
app.include_router(captions.router, prefix="/api/v1")
app.include_router(premiere_transcript.router, prefix="/api/v1")
app.include_router(fonts.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")


@app.get("/")
def root() -> dict:
    return {"service": settings.app_name, "status": "ok"}
