import pytest
from fastapi.testclient import TestClient

from app import main


def minimal_optimize_payload():
    return {
        "plan_date": "2026-05-10T12:00:00Z",
        "objective": "distance",
        "vehicles": [
            {
                "id": "vehicle-1",
                "start_lat": 41.0,
                "start_lng": -87.0,
                "capacity_weight": 100,
                "capacity_volume": 100,
            }
        ],
        "stops": [
            {
                "id": "stop-1",
                "lat": 41.1,
                "lng": -87.1,
                "service_minutes": 5,
            }
        ],
    }


def test_optimize_rejects_missing_internal_token(monkeypatch):
    monkeypatch.setenv("ROUTING_SERVICE_INTERNAL_TOKEN", "configured-token")
    client = TestClient(main.app)

    response = client.post("/optimize", json=minimal_optimize_payload())

    assert response.status_code == 401


def test_health_reports_render_release_sha(monkeypatch):
    release_sha = "a" * 40
    monkeypatch.setenv("RENDER_GIT_COMMIT", release_sha)
    client = TestClient(main.app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["release_sha"] == release_sha


def test_optimize_rejects_wrong_internal_token(monkeypatch):
    monkeypatch.setenv("ROUTING_SERVICE_INTERNAL_TOKEN", "configured-token")
    client = TestClient(main.app)

    response = client.post(
        "/optimize",
        json=minimal_optimize_payload(),
        headers={"x-routing-service-token": "wrong-token"},
    )

    assert response.status_code == 401


def test_optimize_accepts_correct_internal_token(monkeypatch):
    monkeypatch.setenv("ROUTING_SERVICE_INTERNAL_TOKEN", "configured-token")
    client = TestClient(main.app)

    response = client.post(
        "/optimize",
        json=minimal_optimize_payload(),
        headers={"x-routing-service-token": "configured-token"},
    )

    assert response.status_code == 200


def test_hosted_startup_requires_internal_token(monkeypatch):
    monkeypatch.setenv("ROUTING_SERVICE_ENV", "production")
    monkeypatch.delenv("ROUTING_SERVICE_INTERNAL_TOKEN", raising=False)

    with pytest.raises(RuntimeError):
        main.validate_security_config()


def test_optimizer_payload_size_limit(monkeypatch):
    monkeypatch.setenv("ROUTING_SERVICE_INTERNAL_TOKEN", "configured-token")
    monkeypatch.setenv("ROUTING_SERVICE_MAX_BODY_BYTES", "10")
    client = TestClient(main.app)

    response = client.post(
        "/optimize",
        content="{}",
        headers={
            "content-type": "application/json",
            "content-length": "11",
            "x-routing-service-token": "configured-token",
        },
    )

    assert response.status_code == 413


def test_invalid_body_limit_config_uses_safe_default(monkeypatch):
    monkeypatch.setenv("ROUTING_SERVICE_INTERNAL_TOKEN", "configured-token")
    monkeypatch.setenv("ROUTING_SERVICE_MAX_BODY_BYTES", "not-a-number")
    client = TestClient(main.app)

    response = client.post(
        "/optimize",
        json=minimal_optimize_payload(),
        headers={"x-routing-service-token": "configured-token"},
    )

    assert response.status_code == 200


def test_optimizer_failure_does_not_leak_internal_error(monkeypatch):
    monkeypatch.setenv("ROUTING_SERVICE_INTERNAL_TOKEN", "configured-token")
    monkeypatch.setattr(
        main,
        "solve_optimize_request",
        lambda _request: (_ for _ in ()).throw(RuntimeError("sensitive provider detail")),
    )
    client = TestClient(main.app)

    response = client.post(
        "/optimize",
        json=minimal_optimize_payload(),
        headers={"x-routing-service-token": "configured-token"},
    )

    assert response.status_code == 500
    assert response.json() == {"detail": "route optimization failed"}
