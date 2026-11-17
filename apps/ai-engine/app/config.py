from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = "YeneCut AI Engine"
    app_version: str = "0.1.0"
    host: str = "127.0.0.1"
    port: int = 8765
    token: str = os.getenv("YENECUT_ENGINE_TOKEN", "yenecut-dev-token")
    max_upload_bytes: int = 2 * 1024 * 1024 * 1024
    max_audio_duration_seconds: float = 6 * 60 * 60
    temp_dir: Path = Path(os.getenv("YENECUT_TEMP_DIR", str(Path.home() / ".yenecut" / "tmp")))
    model_dir: Path = Path(os.getenv("YENECUT_MODEL_DIR", str(Path.home() / ".yenecut" / "models")))
    default_whisper_model: str = os.getenv("YENECUT_WHISPER_MODEL", "small")
    device: str = os.getenv("YENECUT_DEVICE", "cpu")
    compute_type: str = os.getenv("YENECUT_COMPUTE_TYPE", "int8")
    ffmpeg_path: str = os.getenv("YENECUT_FFMPEG_PATH", "ffmpeg")
    request_timeout_seconds: int = int(os.getenv("YENECUT_REQUEST_TIMEOUT", "3600"))

    def ensure_dirs(self) -> None:
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.model_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
