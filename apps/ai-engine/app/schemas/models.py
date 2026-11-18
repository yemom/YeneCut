from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SilenceSettings(BaseModel):
    threshold_db: float = -40.0
    min_silence_duration: float = 0.5
    min_speech_duration: float = 0.25
    pre_speech_padding: float = 0.1
    post_speech_padding: float = 0.1
    noise_tolerance: float = 0.05
    sensitivity: float = 0.5
    preserve_breathing: bool = True
    preserve_background_music: bool = True
    preserve_short_pauses: bool = True
    preview_mode: bool = True


class SilenceDetectionRequest(BaseModel):
    source_path: str
    settings: SilenceSettings = Field(default_factory=SilenceSettings)


class SilenceRegion(BaseModel):
    start: float
    end: float
    duration: float
    confidence: float


class SilenceDetectionResponse(BaseModel):
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    duration: float
    silence_regions: list[SilenceRegion]
    estimated_removable_duration: float
    job_id: str | None = None


class TranscriptionRequest(BaseModel):
    source_path: str
    language: str | None = "am"
    model_size: str = "small"
    device: str | None = None
    compute_type: str | None = None
    word_timestamps: bool = True
    chunk_length_seconds: int = 300


class TranscriptWord(BaseModel):
    start: float
    end: float
    text: str
    confidence: float | None = None


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    confidence: float | None = None
    words: list[TranscriptWord] = Field(default_factory=list)


class TranscriptionResponse(BaseModel):
    status: Literal["completed", "failed", "cancelled", "queued", "running"]
    language: str
    segments: list[TranscriptSegment]
    job_id: str | None = None
    progress: float = 0.0


class CaptionSegmentRequest(BaseModel):
    segments: list[TranscriptSegment]
    max_chars_per_line: int = 42
    max_lines: int = 2
    min_duration: float = 1.0
    max_duration: float = 6.0
    reading_speed_cps: float = 17.0


class CaptionSegment(BaseModel):
    start: float
    end: float
    text: str


class CaptionExportRequest(BaseModel):
    captions: list[CaptionSegment]
    format: Literal["srt", "vtt", "ass"] = "srt"
    output_path: str | None = None
    style: dict = Field(default_factory=dict)


class FontValidationRequest(BaseModel):
    font_path: str | None = None
    family: str | None = None


class FontValidationResponse(BaseModel):
    available: bool
    family: str
    path: str | None = None
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    job_type: str
    status: str
    progress: float
    error: str | None = None
    result: dict | None = None
