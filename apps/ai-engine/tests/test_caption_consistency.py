"""
Tests for Canonical Caption & Premiere Transcript Consistency.
"""

from __future__ import annotations

import json
import pytest

from app.core.exceptions import ValidationError
from app.engines.subtitles.canonical_pipeline import CanonicalTranscript
from app.schemas.models import TranscriptSegment, TranscriptWord


def test_canonical_pipeline_zero_word_loss_and_parity():
    """Verify that SRT and Premiere JSON both contain the EXACT same sequence of words."""
    words_input = [
        TranscriptWord(start=0.0, end=1.0, text="ሰላም"),
        TranscriptWord(start=1.0, end=2.5, text="ኢትዮጵያ፤"),
        TranscriptWord(start=2.5, end=4.0, text="ይህ"),
        TranscriptWord(start=4.0, end=5.5, text="በየነካት"),
        TranscriptWord(start=5.5, end=6.5, text="AI"),
        TranscriptWord(start=6.5, end=8.0, text="የተዘጋጀ"),
        TranscriptWord(start=8.0, end=9.5, text="ንዑስ"),
        TranscriptWord(start=9.5, end=11.0, text="ጽሑፍ"),
        TranscriptWord(start=11.0, end=12.0, text="ነው።"),
    ]
    seg1 = TranscriptSegment(
        start=0.0,
        end=6.5,
        text="ሰላም ኢትዮጵያ፤ ይህ በየነካት AI",
        words=words_input[:5],
    )
    seg2 = TranscriptSegment(
        start=6.5,
        end=12.0,
        text="የተዘጋጀ ንዑስ ጽሑፍ ነው።",
        words=words_input[5:],
    )

    canonical = CanonicalTranscript(language="am", segments=[seg1, seg2])
    canonical.validate_timings()
    canonical.normalize_text()

    source_words = canonical.total_words()
    assert len(source_words) == 9

    # 1. Check SRT serialization
    srt_out = canonical.to_srt()
    for w in source_words:
        assert w in srt_out, f"Word {w} missing from SRT"

    # 2. Check Premiere JSON serialization
    prem_json = canonical.to_premiere_json()
    parsed = json.loads(prem_json)

    assert parsed["language"] == "am-ET"
    assert len(parsed["segments"]) == 2

    # Extract all words from Premiere JSON
    prem_words = [
        w["text"]
        for s in parsed["segments"]
        for w in s["words"]
    ]
    assert len(prem_words) == len(source_words), "Word count mismatch between canonical and Premiere JSON!"
    assert prem_words == source_words, "Word order or spelling drifted in Premiere JSON!"


def test_canonical_pipeline_punctuation_preservation():
    """Verify Ge'ez punctuation survives canonical normalization and serialization."""
    text_with_punct = "አዲስ አበባ፤ ድሬዳዋ፥ ጎንደር፦ ታሪካዊ ከተሞች ናቸው።"
    seg = TranscriptSegment(start=0.0, end=5.0, text=text_with_punct, words=[])
    canonical = CanonicalTranscript(language="am", segments=[seg])
    canonical.normalize_text()

    prem_json = canonical.to_premiere_json()
    assert "፤" in prem_json
    assert "፥" in prem_json
    assert "፦" in prem_json
    assert "።" in prem_json


def test_canonical_pipeline_mixed_languages_and_numbers():
    """Verify mixed Amharic, English, and numbers are safely preserved."""
    mixed_text = "በ 2026 ዓ.ም YeneCut AI ስሪት 1.0 ተለቀቀ።"
    seg = TranscriptSegment(start=0.0, end=4.0, text=mixed_text, words=[])
    canonical = CanonicalTranscript(language="am", segments=[seg])
    canonical.normalize_text()

    srt_out = canonical.to_srt()
    prem_json = canonical.to_premiere_json()

    assert "2026" in srt_out and "2026" in prem_json
    assert "YeneCut" in srt_out and "YeneCut" in prem_json
    assert "1.0" in srt_out and "1.0" in prem_json


def test_canonical_pipeline_rejects_negative_timestamps():
    """Verify validation error when timestamps are negative."""
    seg = TranscriptSegment(start=-1.0, end=5.0, text="invalid", words=[])
    canonical = CanonicalTranscript(language="am", segments=[seg])
    with pytest.raises(ValidationError, match="Negative timestamps"):
        canonical.validate_timings()


def test_canonical_pipeline_rejects_invalid_duration():
    """Verify validation error when end < start."""
    seg = TranscriptSegment(start=5.0, end=3.0, text="inverted", words=[])
    canonical = CanonicalTranscript(language="am", segments=[seg])
    with pytest.raises(ValidationError, match="Invalid duration"):
        canonical.validate_timings()
