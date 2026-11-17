from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import settings
from app.core.security import verify_token, validate_source_path
from app.engines.audio.audio_loader import load_wav
from app.engines.audio.audio_normalizer import prepare_audio

router = APIRouter(dependencies=[Depends(verify_token)])


@router.post("/audio/analyze")
def analyze_audio(payload: dict) -> dict:
    source_path = payload.get("source_path")
    source = validate_source_path(source_path, settings.max_upload_bytes)
    from app.engines.audio.audio_extractor import extract_audio

    audio_path = extract_audio(source, settings.max_upload_bytes)
    try:
        audio = load_wav(audio_path)
        prepared = prepare_audio(audio, settings.max_audio_duration_seconds)
        return {
            "status": "completed",
            "duration": prepared.duration,
            "sample_rate": prepared.sample_rate,
            "samples": len(prepared.samples),
        }
    finally:
        try:
            audio_path.unlink(missing_ok=True)
        except Exception:
            pass
