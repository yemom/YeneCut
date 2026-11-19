from __future__ import annotations

from dataclasses import dataclass

from app.schemas.models import SilenceRegion, SilenceSettings


@dataclass
class SpeechSegment:
    start: float
    end: float


def merge_intervals(intervals: list[tuple[float, float]], gap: float) -> list[tuple[float, float]]:
    if not intervals:
        return []
    ordered = sorted(intervals)
    merged = [ordered[0]]
    for start, end in ordered[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end + gap:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def filter_intervals(intervals: list[tuple[float, float]], min_duration: float) -> list[tuple[float, float]]:
    return [(s, e) for s, e in intervals if e - s >= min_duration]


def speech_to_silence(speech: list[tuple[float, float]], duration: float) -> list[tuple[float, float]]:
    if not speech:
        return [(0.0, duration)] if duration > 0 else []
    intervals: list[tuple[float, float]] = []
    if speech[0][0] > 0:
        intervals.append((0.0, speech[0][0]))
    for (prev_start, prev_end), (next_start, next_end) in zip(speech, speech[1:]):
        if next_start > prev_end:
            intervals.append((prev_end, next_start))
    if speech[-1][1] < duration:
        intervals.append((speech[-1][1], duration))
    return intervals


def recommended_cuts(
    silence_intervals: list[tuple[float, float]],
    settings: SilenceSettings,
    total_duration: float,
) -> list[SilenceRegion]:
    cuts: list[SilenceRegion] = []
    for start, end in silence_intervals:
        # Preserve padding around speech safely
        if start == 0.0:
            cut_start = 0.0
            cut_end = max(0.0, end - settings.pre_speech_padding)
        elif end >= total_duration:
            cut_start = min(total_duration, start + settings.post_speech_padding)
            cut_end = total_duration
        else:
            cut_start = start + settings.post_speech_padding
            cut_end = end - settings.pre_speech_padding

        if cut_end <= cut_start or (cut_end - cut_start) < settings.min_silence_duration:
            continue

        # Recommendation heuristic score bounded between 0.50 and 0.98
        score = min(0.98, max(0.5, 0.6 + (end - start) * 0.05 + settings.sensitivity * 0.2))
        if settings.preserve_short_pauses and (end - start) < settings.min_silence_duration * 2:
            score *= 0.85

        cuts.append(
            SilenceRegion(
                start=round(cut_start, 4),
                end=round(cut_end, 4),
                duration=round(cut_end - cut_start, 4),
                confidence=round(score, 4),
            )
        )
    return cuts
