from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np

from app.core.exceptions import EngineUnavailableError


class VADDetectorProtocol(Protocol):
    def detect(self, audio: np.ndarray, sample_rate: int) -> list[tuple[float, float]]: ...


@dataclass
class EnergyVADDetector:
    threshold_db: float = -40.0
    frame_ms: int = 20
    min_speech_duration: float = 0.25
    min_silence_duration: float = 0.1

    def detect(self, audio: np.ndarray, sample_rate: int) -> list[tuple[float, float]]:
        if sample_rate <= 0:
            raise ValueError("sample_rate must be positive")
        frame_size = max(1, int(sample_rate * self.frame_ms / 1000))
        frames = []
        for i in range(0, len(audio), frame_size):
            chunk = audio[i : i + frame_size]
            if len(chunk) == 0:
                continue
            rms = float(np.sqrt(np.mean(chunk * chunk) + 1e-12))
            db = 20.0 * np.log10(rms + 1e-12)
            frames.append((i / sample_rate, db >= self.threshold_db))
        segments: list[tuple[float, float]] = []
        start: float | None = None
        for frame_start, is_speech in frames:
            if is_speech and start is None:
                start = frame_start
            if (not is_speech or frame_start == frames[-1][0]) and start is not None:
                end = frame_start + self.frame_ms / 1000.0
                if end - start >= self.min_speech_duration:
                    segments.append((start, min(end, len(audio) / sample_rate)))
                start = None
        if start is not None:
            end = len(audio) / sample_rate
            if end - start >= self.min_speech_duration:
                segments.append((start, end))
        # Merge short silence gaps.
        merged: list[tuple[float, float]] = []
        for seg in segments:
            if merged and seg[0] - merged[-1][1] <= self.min_silence_duration:
                merged[-1] = (merged[-1][0], max(merged[-1][1], seg[1]))
            else:
                merged.append(seg)
        return merged


def create_vad_detector(threshold_db: float = -40.0) -> EnergyVADDetector:
    """Factory for the default VAD detector.

    Silero VAD is preferred when installed; this energy-based detector is a
    deterministic, dependency-free implementation used for tests and fallback.
    """
    try:
        import silero_vad  # noqa: F401

        # The optional Silero integration is intentionally not forced here because
        # model downloads can be large. The engine layer may use it when configured.
    except Exception:
        pass
    return EnergyVADDetector(threshold_db=threshold_db)
