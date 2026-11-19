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


def test_security_validate_source_path_validation(tmp_path):
    """Test path security on empty, nonexistent, oversized, and valid media files."""
    from app.core.security import validate_output_path, sanitize_filename

    # Empty path
    with pytest.raises(SecurityError, match="source_path is required"):
        validate_source_path("", max_bytes=1024)

    # Nonexistent file
    with pytest.raises(SecurityError, match="source file does not exist"):
        validate_source_path(str(tmp_path / "nonexistent.wav"), max_bytes=1024)

    # Valid file
    valid_wav = tmp_path / "valid.wav"
    valid_wav.write_bytes(b"RIFF" + (36).to_bytes(4, "little") + b"WAVE" + b"\x00" * 32)
    res = validate_source_path(str(valid_wav), max_bytes=1024)
    assert res == valid_wav.resolve()

    # Oversized file
    with pytest.raises(SecurityError, match="outside allowed range"):
        validate_source_path(str(valid_wav), max_bytes=10)

    # Output path validation
    out_valid = tmp_path / "subtitles" / "output.srt"
    res_out = validate_output_path(str(out_valid))
    assert res_out.suffix == ".srt"
    assert res_out.parent.exists()

    with pytest.raises(SecurityError, match="unsupported output extension"):
        validate_output_path(str(tmp_path / "danger.bat"))

    # Sanitize filename
    assert sanitize_filename("../evil<script>.wav") == "evilscript.wav"
    assert sanitize_filename("") == "output"


def test_security_rejects_unc_network_paths():
    """Verify that remote UNC paths are rejected to prevent Windows SMB/NTLM leaks."""
    with pytest.raises(SecurityError, match="UNC network paths are not allowed"):
        validate_source_path(r"\\remote-server\share\audio.wav", max_bytes=1024 * 1024)

    with pytest.raises(SecurityError, match="UNC network paths are not allowed"):
        validate_source_path(r"//remote-server/share/audio.wav", max_bytes=1024 * 1024)


def test_security_rejects_device_and_extended_paths():
    """Verify that device namespaces and extended paths are rejected."""
    with pytest.raises(SecurityError, match="device and extended paths are not allowed"):
        validate_source_path(r"\\.\COM1", max_bytes=1024 * 1024)

    with pytest.raises(SecurityError, match="device and extended paths are not allowed"):
        validate_source_path(r"\\?\UNC\server\share\audio.wav", max_bytes=1024 * 1024)

    with pytest.raises(SecurityError, match="device and extended paths are not allowed"):
        validate_source_path(r"\\?\C:\media\audio.wav", max_bytes=1024 * 1024)


def test_security_rejects_windows_reserved_names():
    """Verify that Windows reserved device names (CON, NUL, AUX, PRN, COM, LPT) are rejected."""
    for name in ["CON.wav", "aux.mp4", "NUL.flac", "com1.ogg", "lpt3.wav"]:
        with pytest.raises(SecurityError, match="Windows reserved device name"):
            validate_source_path(f"C:\\videos\\{name}", max_bytes=1024 * 1024)


def test_security_rejects_symlink_or_junction(tmp_path, monkeypatch):
    """Verify that symlinks and junctions are blocked when realpath differs from abspath."""
    target = tmp_path / "real.wav"
    target.write_bytes(b"RIFF" + (36).to_bytes(4, "little") + b"WAVE" + b"\x00" * 32)

    monkeypatch.setattr("os.path.realpath", lambda p: str(tmp_path / "escaped_target.wav"))
    with pytest.raises(SecurityError, match="symlink or junction is not allowed"):
        validate_source_path(str(target), max_bytes=1024)


def test_security_auth_token_rejection():
    """Verify that requests without token or with wrong token receive 401."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # Missing token
    resp = client.post("/api/v1/silence/detect", json={"source_path": "test.wav"})
    assert resp.status_code == 401

    # Invalid token
    resp = client.post(
        "/api/v1/silence/detect",
        json={"source_path": "test.wav"},
        headers={"X-YeneCut-Token": "wrong-token-value"},
    )
    assert resp.status_code == 401

