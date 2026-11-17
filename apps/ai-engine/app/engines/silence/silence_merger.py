from __future__ import annotations

from app.engines.silence.silence_analyzer import merge_intervals


def merge_silence_regions(regions: list[tuple[float, float]], gap: float = 0.15) -> list[tuple[float, float]]:
    return merge_intervals(regions, gap)
