from __future__ import annotations

import re
import unicodedata

# Amharic lives in the Ethiopic Unicode block. This processor is intentionally
# conservative: it never translates and never changes Ge'ez letters.

ETHIOPIC_RANGE_START = 0x1200
ETHIOPIC_RANGE_END = 0x137F


def is_ethiopic_char(char: str) -> bool:
    return ETHIOPIC_RANGE_START <= ord(char) <= ETHIOPIC_RANGE_END


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_amharic(text: str) -> str:
    # Unicode NFKC can damage some Ethiopic punctuation; use NFC only.
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\u200b", "").replace("\ufeff", "")
    text = normalize_whitespace(text)
    return text


def correct_punctuation(text: str) -> str:
    text = text.replace("  ", " ")
    text = text.replace(" ,", ",").replace(" .", ".").replace(" !", "!").replace(" ?", "?")
    text = text.replace("።።", "።")
    return text


def detect_duplicate_words(text: str) -> list[str]:
    words = text.split()
    duplicates = []
    for previous, current in zip(words, words[1:]):
        if previous == current:
            duplicates.append(current)
    return duplicates


def validate_text(text: str) -> bool:
    return isinstance(text, str) and len(text.strip()) > 0
