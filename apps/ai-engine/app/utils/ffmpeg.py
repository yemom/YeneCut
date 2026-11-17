from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.config import settings
from app.core.exceptions import ProcessingError


def ffmpeg_available() -> bool:
    try:
        subprocess.run(
            [settings.ffmpeg_path, "-version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
            timeout=10,
        )
        return True
    except Exception:
        return False


def run_ffmpeg(args: list[str], timeout: int | None = None) -> None:
    command = [settings.ffmpeg_path, "-y", *args]
    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout or settings.request_timeout_seconds,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        raise ProcessingError(f"FFmpeg failed: {stderr[-2000:]}")


def extract_audio_to_wav(source_path: Path, output_path: Path, sample_rate: int = 16000) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    run_ffmpeg(
        [
            "-i",
            str(source_path),
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            str(sample_rate),
            "-ac",
            "1",
            str(output_path),
        ]
    )
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise ProcessingError("FFmpeg did not produce an audio file")
    return output_path


def temp_wav_path(prefix: str = "yenecut") -> Path:
    fd, name = tempfile.mkstemp(prefix=f"{prefix}_", suffix=".wav", dir=settings.temp_dir)
    os.close(fd)
    return Path(name)
