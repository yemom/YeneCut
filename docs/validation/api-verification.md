# API Verification

Engine base URL: `http://127.0.0.1:8765`

Authentication:
- Header: `X-YeneCut-Token`
- Compared with `YENECUT_ENGINE_TOKEN`.

Verified endpoints:
- `GET /health`
- `POST /api/v1/audio/analyze`
- `POST /api/v1/silence/detect`
- `POST /api/v1/transcription/jobs`
- `GET /api/v1/transcription/jobs/{job_id}`
- `POST /api/v1/captions/segment`
- `POST /api/v1/captions/export`
- `POST /api/v1/captions/premiere-transcript`
- `GET /api/v1/fonts`
- `POST /api/v1/fonts/validate`
- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/jobs/{job_id}/cancel`
- `DELETE /api/v1/jobs/{job_id}`

Verification method:
- FastAPI TestClient.
- Real WAV fixture generated with NumPy/SciPy.
- Real FFmpeg is optional; WAV input is processed directly in Python.

Result:
- 10 Python tests pass.
- Engine import passes.
- Health endpoint returns status `ok`.
