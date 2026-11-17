from __future__ import annotations

from app.engines.audio.audio_loader import AudioData, normalize_audio, validate_audio


def prepare_audio(audio: AudioData, max_duration: float, normalize: bool = True) -> AudioData:
    validate_audio(audio, max_duration)
    if normalize:
        return normalize_audio(audio)
    return audio
