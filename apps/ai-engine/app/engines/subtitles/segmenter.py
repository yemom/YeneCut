from __future__ import annotations

from app.schemas.models import CaptionSegment, TranscriptSegment, TranscriptWord


def _split_text_for_lines(text: str, max_chars_per_line: int, max_lines: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip() if current else word
        if len(candidate) <= max_chars_per_line:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
            if len(lines) >= max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    if not lines:
        lines = [text[:max_chars_per_line]]
    return lines


def segment_transcript(
    segments: list[TranscriptSegment],
    max_chars_per_line: int = 42,
    max_lines: int = 2,
    min_duration: float = 1.0,
    max_duration: float = 6.0,
    reading_speed_cps: float = 17.0,
) -> list[CaptionSegment]:
    captions: list[CaptionSegment] = []
    for segment in segments:
        text = " ".join(segment.text.split())
        if not text:
            continue
        duration = max(segment.end - segment.start, 0.01)
        if segment.words:
            # Word-level greedy segmentation.
            current_words: list[TranscriptWord] = []
            current_start = segment.words[0].start
            for word in segment.words:
                current_words.append(word)
                candidate_text = " ".join(w.text for w in current_words)
                est_duration = word.end - current_start
                too_long = len(candidate_text) > max_chars_per_line * max_lines
                too_slow = len(candidate_text) / max(est_duration, 0.01) > reading_speed_cps
                too_long_duration = est_duration > max_duration
                if too_long or too_slow or too_long_duration:
                    # finalize previous words excluding current word
                    if len(current_words) > 1:
                        current_words.pop()
                        final_text = " ".join(w.text for w in current_words)
                        captions.append(
                            CaptionSegment(
                                start=round(current_start, 3),
                                end=round(current_words[-1].end, 3),
                                text=final_text,
                            )
                        )
                        current_words = [word]
                        current_start = word.start
            if current_words:
                captions.append(
                    CaptionSegment(
                        start=round(current_start, 3),
                        end=round(current_words[-1].end, 3),
                        text=" ".join(w.text for w in current_words),
                    )
                )
        else:
            # Segment-level fallback: split by character budget.
            lines = _split_text_for_lines(text, max_chars_per_line, max_lines)
            chunk_text = "\n".join(lines)
            end = min(segment.end, segment.start + max_duration)
            end = max(end, segment.start + min_duration)
            captions.append(CaptionSegment(start=round(segment.start, 3), end=round(end, 3), text=chunk_text))
    # Normalize overlaps and durations.
    normalized: list[CaptionSegment] = []
    for caption in captions:
        start = caption.start
        end = max(caption.end, start + min_duration)
        if normalized and start < normalized[-1].end:
            start = normalized[-1].end
            if start >= end:
                end = start + min_duration
        if end - start > max_duration:
            end = start + max_duration
        normalized.append(CaptionSegment(start=round(start, 3), end=round(end, 3), text=caption.text))
    return normalized
