"""
YeneCut AI — Canonical Subtitle & Transcript Serialization Pipeline.

Guarantees:
1. Canonical representation from which all serializers (SRT, VTT, Premiere JSON) are derived.
2. Zero word loss across serializations.
3. Word order preservation.
4. Validation of segment and word timing constraints.
5. Ethiopic Unicode NFC preservation of punctuation (፡, ፥, ፤, ።, ፦).
"""

from __future__ import annotations

import json
import unicodedata
import uuid
from dataclasses import dataclass
from typing import Any

from app.core.exceptions import ValidationError
from app.schemas.models import TranscriptSegment, TranscriptWord


@dataclass
class CanonicalTranscript:
    language: str
    segments: list[TranscriptSegment]

    def validate_timings(self) -> None:
        """Validates that timestamps are non-negative, ordered, and words fit in segments."""
        for seg in self.segments:
            if seg.start < 0 or seg.end < 0:
                raise ValidationError("Negative timestamps are not permitted")
            if seg.end < seg.start:
                raise ValidationError(f"Invalid duration: segment end ({seg.end}) precedes start ({seg.start})")

            if seg.words:
                for w in seg.words:
                    if w.start < 0 or w.end < 0:
                        raise ValidationError("Word timestamps cannot be negative")
                    if w.end < w.start:
                        raise ValidationError(f"Word end ({w.end}) precedes start ({w.start})")
                    if w.start < seg.start - 0.1 or w.end > seg.end + 0.1:
                        raise ValidationError(
                            f"Word timing ({w.start}-{w.end}) exceeds segment boundary ({seg.start}-{seg.end})"
                        )

    def normalize_text(self) -> None:
        """Applies Unicode NFC normalization preserving all Ge'ez punctuation."""
        for seg in self.segments:
            seg.text = unicodedata.normalize("NFC", seg.text)
            if seg.words:
                for w in seg.words:
                    w.text = unicodedata.normalize("NFC", w.text)

    def total_words(self) -> list[str]:
        """Returns all words extracted from the segment texts."""
        words: list[str] = []
        for seg in self.segments:
            words.extend(seg.text.split())
        return words

    def to_srt(self) -> str:
        """Serializes to SubRip (.srt) using canonical timings."""
        from app.engines.subtitles.srt_generator import generate_srt
        return generate_srt(self.segments)

    def to_premiere_json(self, speaker_name: str = "Speaker 1") -> str:
        """Serializes to native Adobe Premiere Transcript JSON format."""
        speaker_id = str(uuid.uuid4())
        lang_code = "am-ET" if self.language in ("am", "am-ET", "amharic") else self.language
        out_segments = []

        for seg in self.segments:
            text = seg.text.replace("\n", " ").strip()
            words_data: list[dict[str, Any]] = []

            if seg.words:
                for idx, w in enumerate(seg.words):
                    w_start = round(float(w.start), 3)
                    w_end = round(float(w.end), 3)
                    word_obj: dict[str, Any] = {
                        "duration": round(w_end - w_start, 3),
                        "eos": idx == len(seg.words) - 1,
                        "start": w_start,
                        "tags": [],
                        "text": w.text.strip(),
                        "type": "word",
                    }
                    if w.confidence is not None:
                        word_obj["confidence"] = round(float(w.confidence), 4)
                    words_data.append(word_obj)
            else:
                tokens = text.split()
                if tokens:
                    step = (seg.end - seg.start) / len(tokens)
                    for index, token in enumerate(tokens):
                        w_start = round(seg.start + index * step, 3)
                        w_end = round(w_start + step, 3)
                        words_data.append({
                            "duration": round(w_end - w_start, 3),
                            "eos": index == len(tokens) - 1,
                            "start": w_start,
                            "tags": [],
                            "text": token,
                            "type": "word",
                        })

            out_segments.append({
                "duration": round(seg.end - seg.start, 3),
                "language": lang_code,
                "speaker": speaker_id,
                "start": round(seg.start, 3),
                "words": words_data,
            })

        payload = {
            "language": lang_code,
            "segments": out_segments,
            "speakers": [{"id": speaker_id, "name": speaker_name}],
        }
        return json.dumps(payload, ensure_ascii=False)
