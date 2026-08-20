"""Application startup smoke tests."""


def test_fastapi_app_imports():
    from app.main import app

    assert app.title == "Routing Optimization Service"


def test_health_reports_release_sha(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.setenv("GIT_SHA", "a" * 40)
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["releaseSha"] == "a" * 40
