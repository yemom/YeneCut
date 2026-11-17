from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.core.security import verify_token
from app.schemas.models import CaptionSegment

router = APIRouter(dependencies=[Depends(verify_token)])


@router.post("/captions/premiere-transcript")
def premiere_transcript(payload: dict) -> dict:
    captions = payload.get("captions", [])
    language = payload.get("language", "??-??")
    speaker_id = str(uuid.uuid4())
    segments = []
    for caption in captions:
        start = float(caption["start"])
        end = float(caption["end"])
        text = str(caption["text"]).replace("\n", " ")
        words = []
        # Simple word timing split evenly.
        tokens = text.split()
        if tokens:
            step = (end - start) / len(tokens)
            for index, token in enumerate(tokens):
                word_start = start + index * step
                word_end = word_start + step
                words.append({
                    "confidence": 1.0,
                    "duration": round(word_end - word_start, 3),
                    "eos": index == len(tokens) - 1,
                    "start": round(word_start, 3),
                    "tags": [],
                    "text": token,
                    "type": "word",
                })
        segments.append({
            "duration": round(end - start, 3),
            "language": "??-??",
            "speaker": speaker_id,
            "start": round(start, 3),
            "words": words,
        })
    transcript = {
        "language": "??-??",
        "segments": segments,
        "speakers": [{"id": speaker_id, "name": "Speaker 1"}],
    }
    import json

    return {"json": json.dumps(transcript, ensure_ascii=False)}
