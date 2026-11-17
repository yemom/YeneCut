from __future__ import annotations

from app.schemas.models import CaptionSegment


def format_srt_time(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis == 1000:
        secs += 1
        millis = 0
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def generate_srt(captions: list[CaptionSegment]) -> str:
    blocks = []
    for index, caption in enumerate(captions, start=1):
        blocks.append(
            f"{index}\n{format_srt_time(caption.start)} --> {format_srt_time(caption.end)}\n{caption.text}\n"
        )
    return "\n".join(blocks).strip() + ("\n" if blocks else "")
