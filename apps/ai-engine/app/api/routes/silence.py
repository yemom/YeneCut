from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query

from app.api.routes.jobs import router as jobs_router  # noqa: F401
from app.config import settings
from app.core.security import verify_token, validate_source_path
from app.engines.audio.audio_extractor import extract_audio
from app.engines.audio.audio_loader import load_wav
from app.engines.audio.audio_normalizer import prepare_audio
from app.engines.silence.cut_recommender import recommend_cuts
from app.engines.silence.silence_analyzer import filter_intervals, merge_intervals, speech_to_silence
from app.engines.silence.vad_detector import EnergyVADDetector
from app.schemas.models import SilenceDetectionRequest, SilenceDetectionResponse
from app.workers.jobs import job_manager

router = APIRouter(dependencies=[Depends(verify_token)])


async def _run_silence(job, request: SilenceDetectionRequest) -> dict:
    job.progress = 0.05
    job.check_cancelled()
    source = validate_source_path(request.source_path, settings.max_upload_bytes)
    job.progress = 0.15
    audio_path = extract_audio(source, settings.max_upload_bytes)
    job.progress = 0.35
    job.check_cancelled()
    audio = load_wav(audio_path)
    prepared = prepare_audio(audio, settings.max_audio_duration_seconds)
    job.progress = 0.5
    detector = EnergyVADDetector(
        threshold_db=request.settings.threshold_db,
        min_speech_duration=request.settings.min_speech_duration,
    )
    speech = detector.detect(prepared.samples, prepared.sample_rate)
    job.progress = 0.7
    silence = speech_to_silence(speech, prepared.duration)
    silence = merge_intervals(silence, gap=0.1)
    silence = filter_intervals(silence, request.settings.min_silence_duration)
    cuts = recommend_cuts(silence, request.settings, prepared.duration)
    job.progress = 0.9
    try:
        audio_path.unlink(missing_ok=True)
    except Exception:
        pass
    estimated = sum(region.duration for region in cuts)
    return {
        "status": "completed",
        "duration": prepared.duration,
        "silence_regions": [region.model_dump() for region in cuts],
        "estimated_removable_duration": estimated,
    }


@router.post("/silence/detect", response_model=SilenceDetectionResponse)
async def detect_silence(
    request: SilenceDetectionRequest,
    sync: bool = Query(default=False),
) -> SilenceDetectionResponse:
    job = job_manager.create("silence")
    if sync:
        result = await _run_silence(job, request)
        return SilenceDetectionResponse(job_id=job.job_id, **result)
    asyncio.create_task(job_manager.run(job, lambda j: _run_silence(j, request)))
    return SilenceDetectionResponse(
        status="queued",
        duration=0.0,
        silence_regions=[],
        estimated_removable_duration=0.0,
        job_id=job.job_id,
    )
