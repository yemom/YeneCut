from __future__ import annotations

import os
os.environ.setdefault("YENECUT_ENGINE_TOKEN", "test-token")

import pytest
from app.core.exceptions import SecurityError
from app.core.security import validate_font_path, validate_source_path
from app.engines.subtitles.segmenter import segment_transcript, _split_text_into_lines
from app.schemas.models import SilenceDetectionResponse, TranscriptSegment


def test_segmenter_zero_word_loss_long_amharic():
    """Regression test: ensure no words are dropped during segmentation."""
    sample_text = (
        "ሰላም ኢትዮጵያ ይህ የአማርኛ ንግግር በቪዲዮ ላይ የሚታይ ጽሑፍ ነው። "
        "የነካት ሶፍትዌር ለኢትዮጵያ ፈጣሪዎች የተዘጋጀ ሲሆን አርትዖትን ያፋጥናል። "
        "የድምጽ ክፍተትን በማስወገድ እና ትክክለኛ የፊደል አገባብ በማቅረብ ይረዳል። "
        "ምንም ቃል ሳይጠፋ ሙሉውን ንግግር ማካተት አለበት።"
    )
    input_words = sample_text.split()
    segment = TranscriptSegment(start=0.0, end=20.0, text=sample_text, words=[])
    captions = segment_transcript([segment], max_chars_per_line=30, max_lines=2)

    assert len(captions) >= 2, "Long text should produce multiple sequential captions"
    all_output_words = [w for c in captions for w in c.text.split()]
    assert len(all_output_words) == len(input_words), (
        f"Text loss detected! Input words: {len(input_words)}, Output words: {len(all_output_words)}"
    )


def test_segmenter_split_lines_preserves_all_words():
    """Verify _split_text_into_lines never breaks out and loses trailing words."""
    text = "አንድ ሁለት ሦስት አራት አምስት ስድስት ሰባት ስምንት ዘጠኝ አስር"
    input_words = text.split()
    lines = _split_text_into_lines(text, max_chars_per_line=12, max_lines=2)
    output_words = [w for line in lines for w in line.split()]
    assert len(output_words) == len(input_words)


def test_security_rejects_prproj_as_media(tmp_path):
    """Regression test: verify .prproj files are blocked from media ingestion."""
    prproj = tmp_path / "project.prproj"
    prproj.write_text("<PremiereProject></PremiereProject>")
    with pytest.raises(SecurityError, match="unsupported media extension"):
        validate_source_path(str(prproj), max_bytes=1024 * 1024)


def test_security_font_validator(tmp_path):
    """Regression test: verify font validator accepts font files and rejects non-fonts."""
    ttf = tmp_path / "AbyssinicaSIL.ttf"
    ttf.write_bytes(b"\x00\x01\x00\x00" + b"\x00" * 100)
    validated = validate_font_path(str(ttf))
    assert validated.exists()

    fake = tmp_path / "script.exe"
    fake.write_bytes(b"MZ")
    with pytest.raises(SecurityError, match="unsupported font extension"):
        validate_font_path(str(fake))


def test_silence_detection_response_allows_queued_status():
    """Regression test: verify SilenceDetectionResponse allows queued and running statuses."""
    resp = SilenceDetectionResponse(
        status="queued",
        duration=0.0,
        silence_regions=[],
        estimated_removable_duration=0.0,
        job_id="test-job-id",
    )
    assert resp.status == "queued"

    resp_running = SilenceDetectionResponse(
        status="running",
        duration=10.0,
        silence_regions=[],
        estimated_removable_duration=2.5,
        job_id="test-job-id",
    )
    assert resp_running.status == "running"
