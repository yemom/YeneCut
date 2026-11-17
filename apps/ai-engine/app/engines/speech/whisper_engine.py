from __future__ import annotations

from pathlib import Path
from typing import Protocol

from app.core.exceptions import EngineUnavailableError
from app.schemas.models import TranscriptSegment, TranscriptWord


class SpeechRecognizer(Protocol):
    def transcribe(self, audio_path: Path, language: str | None, word_timestamps: bool) -> tuple[str, list[TranscriptSegment]]: ...


class FasterWhisperEngine:
    def __init__(self, model_size: str = "small", device: str = "cpu", compute_type: str = "int8", model_dir: str | None = None):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.model_dir = model_dir
        self._model = None

    def _load(self):
        if self._model is not None:
            return self._model
        try:
            from faster_whisper import WhisperModel
        except Exception as exc:
            raise EngineUnavailableError(
                "faster-whisper is not installed. Install it with: pip install faster-whisper"
            ) from exc
        try:
            self._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
                download_root=self.model_dir,
            )
        except Exception as exc:
            raise EngineUnavailableError(f"Could not load Whisper model: {exc}") from exc
        return self._model

    def transcribe(self, audio_path: Path, language: str | None = None, word_timestamps: bool = True) -> tuple[str, list[TranscriptSegment]]:
        model = self._load()
        try:
            segments, info = model.transcribe(
                str(audio_path),
                language=language if language and language != "auto" else None,
                word_timestamps=word_timestamps,
                vad_filter=True,
            )
        except Exception as exc:
            raise EngineUnavailableError(f"Whisper transcription failed: {exc}") from exc
        detected_language = getattr(info, "language", language or "unknown")
        result: list[TranscriptSegment] = []
        for segment in segments:
            words = []
            for word in getattr(segment, "words", None) or []:
                words.append(
                    TranscriptWord(
                        start=float(word.start),
                        end=float(word.end),
                        text=str(word.word).strip(),
                        confidence=getattr(word, "probability", None),
                    )
                )
            result.append(
                TranscriptSegment(
                    start=float(segment.start),
                    end=float(segment.end),
                    text=str(segment.text).strip(),
                    confidence=None,
                    words=words,
                )
            )
        return detected_language, result


def create_recognizer(model_size: str, device: str, compute_type: str, model_dir: str | None = None) -> FasterWhisperEngine:
    return FasterWhisperEngine(model_size=model_size, device=device, compute_type=compute_type, model_dir=model_dir)
