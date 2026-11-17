from __future__ import annotations

from pathlib import Path

from app.engines.speech.whisper_engine import SpeechRecognizer


def detect_language(recognizer: SpeechRecognizer, audio_path: Path) -> str:
    # A lightweight wrapper: transcription auto-detects language when language=None.
    language, _ = recognizer.transcribe(audio_path, None, False)
    return language
