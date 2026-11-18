# YeneCut AI Engine — REST API Reference

Base URL: `http://127.0.0.1:8765`  
Authentication: `X-YeneCut-Token` header

---

## Endpoints

### 1. Health & Diagnostics
- **`GET /health`** (Unauthenticated)
  - Returns engine readiness, version, FFmpeg status, and Faster-Whisper status.
  - Response:
    ```json
    {
      "status": "ok",
      "service": "YeneCut AI Engine",
      "version": "0.1.0",
      "ffmpeg_available": true,
      "faster_whisper_available": true,
      "device": "cpu",
      "compute_type": "int8"
    }
    ```

### 2. Silence Detection
- **`POST /api/v1/silence/detect?sync=true`**
  - Analyzes audio and detects speech vs silence regions.
  - Request:
    ```json
    {
      "source_path": "C:\\Media\\interview.mp4",
      "settings": {
        "threshold_db": -40.0,
        "min_silence_duration": 0.5,
        "min_speech_duration": 0.25,
        "pre_speech_padding": 0.1,
        "post_speech_padding": 0.1,
        "sensitivity": 0.5
      }
    }
    ```
  - Response:
    ```json
    {
      "status": "completed",
      "duration": 60.5,
      "silence_regions": [
        {"start": 10.1, "end": 12.3, "duration": 2.2, "confidence": 0.85}
      ],
      "estimated_removable_duration": 2.2,
      "job_id": "uuid"
    }
    ```

### 3. Speech Recognition & Transcription
- **`POST /api/v1/transcription/jobs?sync=true`**
  - Transcribes audio into timed segments using Faster-Whisper.
  - Request:
    ```json
    {
      "source_path": "C:\\Media\\interview.mp4",
      "language": "am",
      "model_size": "small",
      "word_timestamps": true
    }
    ```

### 4. Caption Segmentation & Export
- **`POST /api/v1/captions/segment`**
  - Segments transcript segments into subtitle-sized chunks without word loss.
- **`POST /api/v1/captions/export`**
  - Formats captions into `srt`, `vtt`, or `ass`.
- **`POST /api/v1/captions/premiere-transcript`**
  - Formats captions into Premiere Pro Transcript JSON with valid BCP-47 codes.

### 5. Font Validation
- **`POST /api/v1/fonts/validate`**
  - Checks if a font file exists and is valid, or if a font family is installed on the OS.
