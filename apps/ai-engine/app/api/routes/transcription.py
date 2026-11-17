from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query

from app.config import settings
from app.core.security import verify_token, validate_source_path
from app.engines.audio.audio_extractor import extract_audio
from app.engines.audio.audio_loader import load_wav
from app.engines.audio.audio_normalizer import prepare_audio
from app.engines.speech.amharic_processor import normalize_amharic
from app.engines.speech.transcript_corrector import correct_transcript
from app.engines.speech.whisper_engine import create_recognizer
from app.schemas.models import (
    TranscriptionRequest,
    TranscriptionResponse,
    TranscriptSegment,
)
from app.workers.jobs import job_manager

router = APIRouter(dependencies=[Depends(verify_token)])


async def _run_transcription(job, request: TranscriptionRequest) -> dict:
    job.progress = 0.05
    job.check_cancelled()
    source = validate_source_path(request.source_path, settings.max_upload_bytes)
    job.progress = 0.15
    audio_path = extract_audio(source, settings.max_upload_bytes)
    job.progress = 0.3
    job.check_cancelled()
    audio = load_wav(audio_path)
    prepared = prepare_audio(audio, settings.max_audio_duration_seconds, normalize=False)
    # Save prepared audio for Whisper (it can read wav).
    from app.utils.ffmpeg import temp_wav_path
    from scipy.io import wavfile
    import numpy as np

    prepared_path = temp_wav_path("prepared")
    wavfile.write(prepared_path, prepared.sample_rate, (prepared.samples * 32767).astype(np.int16))
    job.progress = 0.45
    device = request.device or settings.device
    compute_type = request.compute_type or settings.compute_type
    recognizer = create_recognizer(request.model_size, device, compute_type, str(settings.model_dir))
    language, segments = recognizer.transcribe(prepared_path, request.language, request.word_timestamps)
    job.progress = 0.8
    corrected_segments = []
    for segment in segments:
        corrected_segments.append(
            TranscriptSegment(
                start=segment.start,
                end=segment.end,
                text=correct_transcript(segment.text) if language and language.startswith("am") else segment.text,
                confidence=segment.confidence,
                words=segment.words,
            )
        )
    for path in (audio_path, prepared_path):
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass
    job.progress = 0.95
    return {
        "status": "completed",
        "language": language or request.language or "unknown",
        "segments": [segment.model_dump() for segment in corrected_segments],
    }


@router.post("/transcription/jobs", response_model=TranscriptionResponse)
async def create_transcription_job(
    request: TranscriptionRequest,
    sync: bool = Query(default=False),
) -> TranscriptionResponse:
    job = job_manager.create("transcription")
    if sync:
        result = await _run_transcription(job, request)
        return TranscriptionResponse(job_id=job.job_id, progress=1.0, **result)
    asyncio.create_task(job_manager.run(job, lambda j: _run_transcription(j, request)))
    return TranscriptionResponse(
        status="queued",
        language=request.language or "unknown",
        segments=[],
        job_id=job.job_id,
        progress=0.0,
    )


@router.get("/transcription/jobs/{job_id}", response_model=TranscriptionResponse)
async def get_transcription_job(job_id: str) -> TranscriptionResponse:
    job = job_manager.get(job_id)
    if job.status == "completed" and job.result:
        return TranscriptionResponse(
            status="completed",
            language=job.result.get("language", "unknown"),
            segments=job.result.get("segments", []),
            job_id=job.job_id,
            progress=job.progress,
        )
    return TranscriptionResponse(
        status=job.status,
        language="unknown",
        segments=[],
        job_id=job.job_id,
        progress=job.progress,
        error=job.error if hasattr(job, "error") else None,
    )
