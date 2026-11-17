from __future__ import annotations

from app.schemas.models import CaptionSegment


def align_timestamps(captions: list[CaptionSegment], min_gap: float = 0.0) -> list[CaptionSegment]:
    result: list[CaptionSegment] = []
    for caption in captions:
        start = caption.start
        end = caption.end
        if result and start < result[-1].end + min_gap:
            start = result[-1].end + min_gap
        if end <= start:
            end = start + 0.5
        result.append(CaptionSegment(start=round(start, 3), end=round(end, 3), text=caption.text))
    return result
