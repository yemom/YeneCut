# API

Base URL: `http://127.0.0.1:8765`
Auth header: `X-YeneCut-Token`

Endpoints:
- GET /health
- POST /api/v1/audio/analyze
- POST /api/v1/silence/detect
- POST /api/v1/transcription/jobs
- GET /api/v1/transcription/jobs/{job_id}
- POST /api/v1/captions/segment
- POST /api/v1/captions/export
- GET /api/v1/fonts
- POST /api/v1/fonts/validate
- GET /api/v1/jobs/{job_id}
- POST /api/v1/jobs/{job_id}/cancel
- DELETE /api/v1/jobs/{job_id}
