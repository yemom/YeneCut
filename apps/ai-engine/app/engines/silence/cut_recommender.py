from __future__ import annotations

from app.engines.silence.silence_analyzer import recommended_cuts
from app.schemas.models import SilenceRegion, SilenceSettings


def recommend_cuts(silence_intervals: list[tuple[float, float]], settings: SilenceSettings, duration: float) -> list[SilenceRegion]:
    return recommended_cuts(silence_intervals, settings, duration)
