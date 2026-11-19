from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

from app.core.exceptions import JobCancelledError, ProcessingError
from app.core.security import validate_source_path
from app.engines.audio.audio_loader import load_wav
from app.utils.ffmpeg import extract_audio_to_wav, temp_wav_path


def _wav_to_16k_mono(source: Path, output: Path) -> Path:
    audio = load_wav(source)
    samples = audio.samples
    sample_rate = audio.sample_rate
    if sample_rate != 16000:
        gcd = np.gcd(sample_rate, 16000)
        samples = resample_poly(samples, 16000 // gcd, sample_rate // gcd)
        sample_rate = 16000
    pcm = np.clip(samples, -1.0, 1.0)
    wavfile.write(output, sample_rate, (pcm * 32767).astype(np.int16))
    return output


def extract_audio(source_path: Path | str, max_bytes: int, cancel_event: Any = None) -> Path:
    validated = validate_source_path(str(source_path), max_bytes)
    output = temp_wav_path("audio")
    if validated.suffix.lower() == ".wav":
        if cancel_event is not None and getattr(cancel_event, "is_set", lambda: False)():
            raise JobCancelledError("Audio extraction cancelled")
        result = _wav_to_16k_mono(validated, output)
        if cancel_event is not None and getattr(cancel_event, "is_set", lambda: False)():
            try:
                output.unlink(missing_ok=True)
            except Exception:
                pass
            raise JobCancelledError("Audio extraction cancelled")
        return result
    try:
        return extract_audio_to_wav(validated, output, cancel_event=cancel_event)
    except Exception as exc:
        raise ProcessingError(f"Could not extract audio: {exc}") from exc
