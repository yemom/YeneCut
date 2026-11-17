from __future__ import annotations

from app.engines.subtitles.srt_generator import format_srt_time
from app.schemas.models import CaptionSegment


def format_vtt_time(seconds: float) -> str:
    return format_srt_time(seconds).replace(",", ".")


def generate_vtt(captions: list[CaptionSegment]) -> str:
    lines = ["WEBVTT", ""]
    for caption in captions:
        lines.append(f"{format_vtt_time(caption.start)} --> {format_vtt_time(caption.end)}")
        lines.append(caption.text)
        lines.append("")
    return "\n".join(lines).strip() + "\n"
