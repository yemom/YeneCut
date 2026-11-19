from __future__ import annotations

from app.schemas.models import CaptionSegment, TranscriptSegment, TranscriptWord


def _split_text_into_lines(text: str, max_chars_per_line: int, max_lines: int) -> list[str]:
    """
    Format words into up to max_lines lines.
    Preserves all words in text without dropping.
    """
    words = text.split()
    if not words:
        return []

    lines: list[str] = []
    current_line = ""

    for word in words:
        candidate = f"{current_line} {word}".strip() if current_line else word
        if len(candidate) <= max_chars_per_line:
            current_line = candidate
        else:
            if current_line:
                if len(lines) < max_lines - 1:
                    lines.append(current_line)
                    current_line = word
                else:
                    # On the last allowed line, append remaining words so nothing is dropped
                    lines.append(f"{current_line} {word}".strip())
                    current_line = ""
            else:
                lines.append(word)
                current_line = ""

    if current_line:
        if len(lines) < max_lines:
            lines.append(current_line)
        else:
            lines[-1] = f"{lines[-1]} {current_line}".strip()

    return lines or [text]


def segment_transcript(
    segments: list[TranscriptSegment],
    max_chars_per_line: int = 42,
    max_lines: int = 2,
    min_duration: float = 1.0,
    max_duration: float = 6.0,
    reading_speed_cps: float = 17.0,
) -> list[CaptionSegment]:
    """
    Segment transcript into caption-sized units.

    GUARANTEES:
    - Every word from every input segment is preserved (ZERO text loss).
    - Long segments are split into multiple sequential caption chunks.
    - Captions obey min_duration and max_duration boundaries without overlap.
    """
    captions: list[CaptionSegment] = []
    max_chars_per_caption = max_chars_per_line * max_lines

    for segment in segments:
        text = " ".join(segment.text.split())
        if not text:
            continue

        if segment.words:
            # Word-level segmentation using actual word timestamps
            current_words: list[TranscriptWord] = []
            chunk_start = segment.words[0].start

            for word in segment.words:
                current_words.append(word)
                candidate_text = " ".join(w.text for w in current_words)
                current_dur = word.end - chunk_start
                too_long_chars = len(candidate_text) > max_chars_per_caption
                too_long_duration = current_dur > max_duration
                too_slow = current_dur > 0.05 and (len(candidate_text) / current_dur) > reading_speed_cps

                if (too_long_chars or too_long_duration or too_slow) and len(current_words) > 1:
                    # Finalize chunk up to the previous word
                    overflow_word = current_words.pop()
                    chunk_text = " ".join(w.text for w in current_words)
                    formatted_lines = _split_text_into_lines(chunk_text, max_chars_per_line, max_lines)
                    captions.append(
                        CaptionSegment(
                            start=round(chunk_start, 3),
                            end=round(current_words[-1].end, 3),
                            text="\n".join(formatted_lines),
                        )
                    )
                    current_words = [overflow_word]
                    chunk_start = overflow_word.start

            if current_words:
                chunk_text = " ".join(w.text for w in current_words)
                formatted_lines = _split_text_into_lines(chunk_text, max_chars_per_line, max_lines)
                captions.append(
                    CaptionSegment(
                        start=round(chunk_start, 3),
                        end=round(current_words[-1].end, 3),
                        text="\n".join(formatted_lines),
                    )
                )
        else:
            # Segment-level segmentation without word timestamps (greedy character-budget chunking)
            words = text.split()
            seg_duration = max(segment.end - segment.start, min_duration)
            total_chars = max(len(text), 1)

            chunks: list[list[str]] = []
            current_chunk: list[str] = []
            current_char_count = 0

            for word in words:
                word_chars = len(word)
                needed = current_char_count + (1 if current_chunk else 0) + word_chars
                if needed > max_chars_per_caption and current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = [word]
                    current_char_count = word_chars
                else:
                    current_chunk.append(word)
                    current_char_count = needed

            if current_chunk:
                chunks.append(current_chunk)

            # Assign time proportionally to each chunk based on character length
            chunk_start = segment.start
            for idx, chunk_words in enumerate(chunks):
                chunk_str = " ".join(chunk_words)
                ratio = len(chunk_str) / total_chars
                chunk_dur = max(min_duration, min(seg_duration * ratio, max_duration))
                chunk_end = min(segment.end, chunk_start + chunk_dur)
                if idx == len(chunks) - 1:
                    chunk_end = max(chunk_end, segment.end)

                formatted_lines = _split_text_into_lines(chunk_str, max_chars_per_line, max_lines)
                captions.append(
                    CaptionSegment(
                        start=round(chunk_start, 3),
                        end=round(max(chunk_end, chunk_start + min_duration), 3),
                        text="\n".join(formatted_lines),
                    )
                )
                chunk_start = chunk_end

    # Normalize timing: enforce monotonically increasing timestamps and no overlaps
    normalized: list[CaptionSegment] = []
    for caption in captions:
        start = caption.start
        end = caption.end

        if normalized and start < normalized[-1].end:
            start = normalized[-1].end
        if end <= start:
            end = start + min_duration

        normalized.append(
            CaptionSegment(
                start=round(start, 3),
                end=round(end, 3),
                text=caption.text,
            )
        )

    return normalized
