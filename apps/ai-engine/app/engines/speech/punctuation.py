from __future__ import annotations

import re

from app.engines.speech.amharic_processor import normalize_amharic


def split_sentences(text: str) -> list[str]:
    normalized = normalize_amharic(text)
    parts = re.split(r"(?<=[።!?\.])\s+", normalized)
    return [part for part in parts if part.strip()]


def add_punctuation(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    if text[-1] not in "።!?.":
        text += "።"
    return text
