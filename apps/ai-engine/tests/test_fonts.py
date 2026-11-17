from __future__ import annotations

import os

os.environ.setdefault("YENECUT_ENGINE_TOKEN", "test-token")

from fastapi.testclient import TestClient

from app.main import app
from app.engines.fonts import load_font_library

client = TestClient(app)
client.headers.update({"X-YeneCut-Token": "test-token"})


def test_font_library_loads():
    fonts = load_font_library()
    assert len(fonts) >= 3
    assert any(font["family"] == "Noto Sans Ethiopic" for font in fonts)


def test_fonts_endpoint():
    response = client.get("/api/v1/fonts")
    assert response.status_code == 200
    assert "fonts" in response.json()


def test_font_validation_missing():
    response = client.post("/api/v1/fonts/validate", json={"family": "Definitely Missing Font"})
    assert response.status_code == 200
    assert response.json()["available"] is False
