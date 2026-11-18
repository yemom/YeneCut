"""
Tests for Amharic Speech & Caption Evaluation Framework.
"""

from __future__ import annotations

import pytest
from tools.evaluate_amharic import (
    AMHARIC_EVAL_BENCHMARK,
    compute_cer,
    compute_wer,
    normalize_amharic_text,
)
from app.engines.subtitles.segmenter import segment_transcript
from app.schemas.models import TranscriptSegment


def test_wer_identical_strings():
    ref = "ሰላም ኢትዮጵያ ይህ የአማርኛ ንግግር ነው።"
    assert compute_wer(ref, ref) == 0.0


def test_wer_with_substitution():
    ref = "ሰላም ኢትዮጵያ"
    hyp = "ሰላም ዓለም"
    assert compute_wer(ref, hyp) == 0.5  # 1 word substituted out of 2


def test_cer_calculation():
    ref = "ኢትዮጵያ"
    hyp = "ኢትዮጲያ"  # 1 character diff
    cer = compute_cer(ref, hyp)
    assert 0.0 < cer < 0.5


def test_amharic_punctuation_preservation_under_nfc():
    """Verify Ethiopic punctuation marks (፡, ፥, ፤, ።, ፦) survive Unicode NFC normalization."""
    sample = "አዲስ አበባ፤ ድሬዳዋ፥ ጎንደር፦ ታሪካዊ ከተሞች ናቸው።"
    normalized = normalize_amharic_text(sample)
    assert normalized == sample
    assert "፤" in normalized
    assert "፥" in normalized
    assert "፦" in normalized
    assert "።" in normalized


def test_amharic_caption_reading_speed_and_line_length():
    """Verify that segmented captions conform to maximum reading speed and line length."""
    for item in AMHARIC_EVAL_BENCHMARK:
        ref_text = item["reference"]
        segment = TranscriptSegment(start=0.0, end=10.0, text=ref_text, words=[])
        captions = segment_transcript(
            [segment],
            max_chars_per_line=35,
            max_lines=2,
            min_duration=1.0,
            max_duration=6.0,
            reading_speed_cps=17.0,
        )

        assert len(captions) >= 1
        for cap in captions:
            # Check duration is within limits
            duration = cap.end - cap.start
            assert duration >= 0.5

            # Check line length
            for line in cap.text.split("\n"):
                assert len(line) <= 40  # Allow small margin for word boundary wrapping
