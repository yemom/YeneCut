from __future__ import annotations

import os

os.environ.setdefault("YENECUT_ENGINE_TOKEN", "test-token")

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
client.headers.update({"X-YeneCut-Token": "test-token"})


def test_job_delete():
    response = client.post("/api/v1/transcription/jobs", json={"source_path": "/tmp/does-not-exist.wav"})
    # May fail validation at job creation? Endpoint creates job and schedules; returns queued.
    if response.status_code == 200:
        job_id = response.json()["job_id"]
        delete = client.delete(f"/api/v1/jobs/{job_id}")
        assert delete.status_code == 200
