from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import verify_token
from app.engines.subtitles.ass_generator import generate_ass
from app.engines.subtitles.segmenter import segment_transcript
from app.engines.subtitles.srt_generator import generate_srt
from app.engines.subtitles.timestamp_aligner import align_timestamps
from app.engines.subtitles.vtt_generator import generate_vtt
from app.schemas.models import (
    CaptionExportRequest,
    CaptionSegment,
    CaptionSegmentRequest,
    TranscriptSegment,
)

router = APIRouter(dependencies=[Depends(verify_token)])


@router.post("/captions/segment")
def segment_captions(request: CaptionSegmentRequest) -> dict:
    captions = segment_transcript(
        [TranscriptSegment(**segment.model_dump()) if isinstance(segment, dict) else segment for segment in request.segments],
        max_chars_per_line=request.max_chars_per_line,
        max_lines=request.max_lines,
        min_duration=request.min_duration,
        max_duration=request.max_duration,
        reading_speed_cps=request.reading_speed_cps,
    )
    captions = align_timestamps(captions)
    return {"captions": [caption.model_dump() for caption in captions]}


@router.post("/captions/export")
def export_captions(request: CaptionExportRequest) -> dict:
    captions = [CaptionSegment(**item) if isinstance(item, dict) else item for item in request.captions]
    if request.format == "srt":
        content = generate_srt(captions)
    elif request.format == "vtt":
        content = generate_vtt(captions)
    else:
        content = generate_ass(captions, request.style)
    output_path = None
    if request.output_path:
        from app.core.security import validate_output_path

        path = validate_output_path(request.output_path)
        path.write_text(content, encoding="utf-8")
        output_path = str(path)
    return {"format": request.format, "content": content, "output_path": output_path}
