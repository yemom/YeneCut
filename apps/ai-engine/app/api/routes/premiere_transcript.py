from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends

from app.core.security import verify_token

router = APIRouter(dependencies=[Depends(verify_token)])

# BCP-47 language code mapping for Premiere Pro
LANGUAGE_MAP = {
    "am": "am-ET",
    "am-ET": "am-ET",
    "amharic": "am-ET",
    "en": "en-US",
    "en-US": "en-US",
    "en-GB": "en-GB",
    "english": "en-US",
    "auto": "und",
    "unknown": "und",
}


def normalize_language_code(code: str | None) -> str:
    if not code or code.strip() in ("??-??", "??", "unknown", ""):
        return "am-ET"  # Default to Amharic (Ethiopia) for YeneCut
    normalized = code.strip().lower()
    return LANGUAGE_MAP.get(normalized, code.strip())


@router.post("/captions/premiere-transcript")
def premiere_transcript(payload: dict[str, Any]) -> dict[str, str]:
    captions = payload.get("captions", [])
    raw_lang = payload.get("language")
    language = normalize_language_code(raw_lang)
    speaker_id = str(uuid.uuid4())
    segments = []

    for caption in captions:
        start = float(caption.get("start", 0.0))
        end = float(caption.get("end", 0.0))
        text = str(caption.get("text", "")).replace("\n", " ").strip()
        words_input = caption.get("words", [])

        words = []
        if words_input:
            # Real word timestamps from speech recognition
            for idx, w in enumerate(words_input):
                w_start = float(w.get("start", start))
                w_end = float(w.get("end", end))
                word_dict: dict[str, Any] = {
                    "duration": round(w_end - w_start, 3),
                    "eos": idx == len(words_input) - 1,
                    "start": round(w_start, 3),
                    "tags": [],
                    "text": str(w.get("text", "")).strip(),
                    "type": "word",
                }
                # Only include confidence if actually provided by ASR model
                if "confidence" in w and w["confidence"] is not None:
                    word_dict["confidence"] = round(float(w["confidence"]), 4)
                words.append(word_dict)
        else:
            # Word-timing estimated from text tokens without fake confidence
            tokens = text.split()
            if tokens:
                step = (end - start) / len(tokens)
                for index, token in enumerate(tokens):
                    word_start = start + index * step
                    word_end = word_start + step
                    words.append({
                        "duration": round(word_end - word_start, 3),
                        "eos": index == len(tokens) - 1,
                        "start": round(word_start, 3),
                        "tags": [],
                        "text": token,
                        "type": "word",
                    })

        segments.append({
            "duration": round(end - start, 3),
            "language": language,
            "speaker": speaker_id,
            "start": round(start, 3),
            "words": words,
        })

    transcript = {
        "language": language,
        "segments": segments,
        "speakers": [{"id": speaker_id, "name": "Speaker 1"}],
    }

    return {"json": json.dumps(transcript, ensure_ascii=False)}
