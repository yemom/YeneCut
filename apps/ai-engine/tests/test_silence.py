import os
os.environ["YENECUT_ENGINE_TOKEN"] = "test-token"

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_test_wav


@pytest.fixture
def client():
    os.environ.setdefault("YENECUT_ENGINE_TOKEN", "test-token")
    # Re-import settings? settings already loaded; set token env before import in real run.
    from app.config import settings

    # Force token for tests by monkeypatching.
    settings.__dict__["token"] = "test-token" if hasattr(settings, "__dict__") else settings.token
    client = TestClient(app)
    client.headers.update({"X-YeneCut-Token": "test-token"})
    return client


@pytest.fixture
def wav_file(tmp_path: Path) -> Path:
    path = tmp_path / "sample.wav"
    make_test_wav(path)
    return path


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_silence_detect_sync(client, wav_file):
    response = client.post(
        "/api/v1/silence/detect?sync=true",
        json={"source_path": str(wav_file), "settings": {"threshold_db": -35.0, "min_silence_duration": 0.3}},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "completed"
    assert data["duration"] > 0
    assert isinstance(data["silence_regions"], list)
    assert data["estimated_removable_duration"] >= 0
