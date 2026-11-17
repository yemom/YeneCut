from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.io import wavfile

from app.core.exceptions import ProcessingError, ValidationError


@dataclass
class AudioData:
    samples: np.ndarray
    sample_rate: int

    @property
    def duration(self) -> float:
        return len(self.samples) / float(self.sample_rate)


def load_wav(path: Path) -> AudioData:
    try:
        sample_rate, data = wavfile.read(path)
    except Exception as exc:
        raise ProcessingError(f"Could not read WAV file: {exc}") from exc
    if data.ndim > 1:
        data = data.mean(axis=1)
    if data.dtype == np.int16:
        samples = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        samples = data.astype(np.float32) / 2147483648.0
    elif data.dtype == np.uint8:
        samples = (data.astype(np.float32) - 128.0) / 128.0
    else:
        samples = data.astype(np.float32)
    if not np.isfinite(samples).all():
        raise ProcessingError("Audio contains non-finite samples")
    return AudioData(samples=samples, sample_rate=int(sample_rate))


def validate_audio(audio: AudioData, max_duration: float) -> None:
    if audio.sample_rate < 8000:
        raise ValidationError("Sample rate is too low")
    if audio.duration <= 0:
        raise ValidationError("Audio duration must be greater than zero")
    if audio.duration > max_duration:
        raise ValidationError(f"Audio duration exceeds limit: {audio.duration}s")
    if len(audio.samples) == 0:
        raise ValidationError("Audio is empty")


def normalize_audio(audio: AudioData, target_peak: float = 0.95) -> AudioData:
    peak = float(np.max(np.abs(audio.samples))) if len(audio.samples) else 0.0
    if peak == 0.0:
        return audio
    gain = target_peak / peak
    if gain > 10.0:
        gain = 10.0
    return AudioData(samples=(audio.samples * gain).astype(np.float32), sample_rate=audio.sample_rate)
