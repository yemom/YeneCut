from __future__ import annotations

from app.engines.speech.amharic_processor import normalize_amharic, correct_punctuation


def correct_transcript(text: str) -> str:
    return correct_punctuation(normalize_amharic(text))
