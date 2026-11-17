from __future__ import annotations

from app.schemas.models import CaptionSegment


def validate_captions(captions: list[CaptionSegment]) -> list[str]:
    errors: list[str] = []
    previous_end = 0.0
    for index, caption in enumerate(captions, start=1):
        if caption.end <= caption.start:
            errors.append(f"Caption {index} has non-positive duration")
        if caption.start < previous_end:
            errors.append(f"Caption {index} overlaps previous caption")
        if not caption.text.strip():
            errors.append(f"Caption {index} is empty")
        previous_end = max(previous_end, caption.end)
    return errors
