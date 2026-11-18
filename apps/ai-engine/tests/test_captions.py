from __future__ import annotations

import os

os.environ.setdefault("YENECUT_ENGINE_TOKEN", "test-token")

from app.engines.speech.amharic_processor import normalize_amharic, correct_punctuation, detect_duplicate_words
from app.engines.subtitles.srt_generator import generate_srt
from app.engines.subtitles.vtt_generator import generate_vtt
from app.engines.subtitles.ass_generator import generate_ass
from app.engines.subtitles.segmenter import segment_transcript
from app.schemas.models import TranscriptSegment


def test_amharic_unicode_preserved():
    text = "ሰላም ኢትዮጵያ!"
    assert normalize_amharic(text) == text


def test_punctuation_correction():
    assert correct_punctuation("ሰላም  ፣") == "ሰላም ፣"


def test_duplicate_detection():
    assert detect_duplicate_words("ሰላም ሰላም") == ["ሰላም"]


def test_segmentation_and_exports():
    segments = [TranscriptSegment(start=0.0, end=2.5, text="ሰላም ኢትዮጵያ ይህ ሙከራ ነው", words=[])]
    captions = segment_transcript(segments, max_chars_per_line=12, max_lines=2)
    assert len(captions) >= 1
    srt = generate_srt(captions)
    vtt = generate_vtt(captions)
    ass = generate_ass(captions)
    assert " --> " in srt
    assert srt.strip().splitlines()[0].isdigit()
    assert vtt.startswith("WEBVTT")
    assert "[Script Info]" in ass

import json
from fastapi.testclient import TestClient
from app.main import app

def test_premiere_transcript_language_and_confidence():
    """Verify Premiere transcript outputs valid BCP-47 and does not fabricate 1.0 confidence."""
    client = TestClient(app)
    headers = {"X-YeneCut-Token": "test-token"}
    payload = {
        "captions": [
            {"start": 0.0, "end": 2.0, "text": "ሰላም ኢትዮጵያ"}
        ],
        "language": "am"
    }
    response = client.post("/api/v1/captions/premiere-transcript", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "json" in data
    transcript = json.loads(data["json"])
    assert transcript["language"] == "am-ET"
    assert transcript["language"] != "??-??"
    for seg in transcript["segments"]:
        assert seg["language"] == "am-ET"
        for word in seg.get("words", []):
            # Synthetic words without ASR should not have fake confidence 1.0
            assert word.get("confidence") != 1.0
