from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from app.config import settings
from app.core.exceptions import JobCancelledError, ProcessingError


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


def run_ffmpeg(args: list[str], timeout: int | None = None, cancel_event: Any = None) -> None:
    import time

    command = [settings.ffmpeg_path, "-y", *args]
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    deadline = time.monotonic() + (timeout or settings.request_timeout_seconds)
    while process.poll() is None:
        if cancel_event is not None and getattr(cancel_event, "is_set", lambda: False)():
            process.kill()
            process.communicate()
            raise JobCancelledError("FFmpeg process cancelled")
        if time.monotonic() > deadline:
            process.kill()
            process.communicate()
            raise ProcessingError("FFmpeg timed out")
        time.sleep(0.1)
    stdout, stderr = process.communicate()
    if process.returncode != 0:
        text = stderr.decode("utf-8", errors="replace")
        raise ProcessingError(f"FFmpeg failed: {text[-2000:]}")


def extract_audio_to_wav(source_path: Path, output_path: Path, sample_rate: int = 16000, cancel_event: Any = None) -> Path:
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
        ],
        cancel_event=cancel_event,
    )
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise ProcessingError("FFmpeg did not produce an audio file")
    return output_path


def temp_wav_path(prefix: str = "yenecut") -> Path:
    fd, name = tempfile.mkstemp(prefix=f"{prefix}_", suffix=".wav", dir=settings.temp_dir)
    os.close(fd)
    return Path(name)
