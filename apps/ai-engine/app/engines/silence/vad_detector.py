from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol

import numpy as np

logger = logging.getLogger("yenecut.vad")


class VADDetectorProtocol(Protocol):
    def detect(self, audio: np.ndarray, sample_rate: int) -> list[tuple[float, float]]: ...
    def get_metadata(self) -> dict[str, Any]: ...


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

        # Merge short silence gaps between speech segments
        merged: list[tuple[float, float]] = []
        for seg in segments:
            if merged and seg[0] - merged[-1][1] <= self.min_silence_duration:
                merged[-1] = (merged[-1][0], max(merged[-1][1], seg[1]))
            else:
                merged.append(seg)
        return merged

    def get_metadata(self) -> dict[str, Any]:
        return {
            "provider": "energy",
            "threshold_db": self.threshold_db,
            "min_speech_duration": self.min_speech_duration,
        }


@dataclass
class SileroVADDetector:
    threshold: float = 0.5
    min_speech_duration: float = 0.25
    _model: Any = None
    _actual_provider: str = "silero"

    def _ensure_model(self) -> Any:
        if self._model is not None:
            return self._model
        import torch
        model, _ = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            force_reload=False,
            onnx=True,
        )
        self._model = model
        return self._model

    def detect(self, audio: np.ndarray, sample_rate: int) -> list[tuple[float, float]]:
        try:
            model = self._ensure_model()
            import torch
            tensor = torch.from_numpy(audio).float()
            from silero_vad import get_speech_timestamps
            timestamps = get_speech_timestamps(
                tensor,
                model,
                sampling_rate=sample_rate,
                threshold=self.threshold,
                min_speech_duration_ms=int(self.min_speech_duration * 1000),
            )
            return [(ts["start"] / sample_rate, ts["end"] / sample_rate) for ts in timestamps]
        except Exception as exc:
            logger.warning(f"Silero VAD inference failed, falling back to Energy VAD: {exc}")
            fallback = EnergyVADDetector(min_speech_duration=self.min_speech_duration)
            self._actual_provider = "energy"
            return fallback.detect(audio, sample_rate)

    def get_metadata(self) -> dict[str, Any]:
        return {
            "provider": self._actual_provider,
            "threshold": self.threshold,
            "min_speech_duration": self.min_speech_duration,
        }


def create_vad_detector(
    threshold_db: float = -40.0,
    min_speech_duration: float = 0.25,
    prefer_silero: bool = False,
) -> VADDetectorProtocol:
    """
    Factory for VAD detector with provider transparency.
    Returns Silero detector if requested and installed; otherwise returns deterministic Energy VAD.
    """
    if prefer_silero:
        try:
            import silero_vad  # noqa: F401
            import torch  # noqa: F401
            return SileroVADDetector(min_speech_duration=min_speech_duration)
        except ImportError:
            logger.info("Silero VAD not installed; using deterministic Energy VAD.")
    return EnergyVADDetector(threshold_db=threshold_db, min_speech_duration=min_speech_duration)
