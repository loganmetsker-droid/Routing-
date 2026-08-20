import pytest

from app.matrix import (
    MatrixProviderError,
    fetch_osrm_matrix,
    resolve_route_matrices,
    validate_matrix_config,
)


class FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "code": "Ok",
            "distances": [[0, 1420], [1390, 0]],
            "durations": [[0, 210.4], [204.6, 0]],
        }


class FakeSession:
    def __init__(self):
        self.request = None

    def get(self, url, **kwargs):
        self.request = (url, kwargs)
        return FakeResponse()


def test_osrm_provider_returns_validated_road_network_matrices(monkeypatch):
    monkeypatch.setenv("ROUTING_MATRIX_BASE_URL", "https://matrix.trytrovan.test")
    monkeypatch.setenv("ROUTING_MATRIX_PROVIDER_LABEL", "pilot-osrm")
    monkeypatch.setenv("ROUTING_MATRIX_TOKEN", "secret-token")
    session = FakeSession()

    result = fetch_osrm_matrix([(39.10, -94.50), (39.20, -94.60)], session=session)

    assert result.distance_m == [[0, 1420], [1390, 0]]
    assert result.duration_s == [[0, 210], [205, 0]]
    assert result.provider == "pilot-osrm"
    assert result.mode == "road_network"
    assert result.fallback_used is False
    assert session.request[0].startswith(
        "https://matrix.trytrovan.test/table/v1/driving/-94.500000,39.100000"
    )
    assert session.request[1]["headers"]["Authorization"] == "Bearer secret-token"


def test_local_provider_failure_is_explicitly_marked_as_estimated(monkeypatch):
    monkeypatch.setenv("ROUTING_MATRIX_PROVIDER", "osrm")
    monkeypatch.delenv("ROUTING_MATRIX_BASE_URL", raising=False)
    monkeypatch.setenv("ROUTING_MATRIX_ALLOW_FALLBACK", "true")

    result = resolve_route_matrices([(39.10, -94.50), (39.20, -94.60)])

    assert result.mode == "estimated"
    assert result.fallback_used is True
    assert "straight-line" in (result.warning or "")


def test_hosted_config_rejects_estimates_and_public_demo(monkeypatch):
    monkeypatch.setenv("ROUTING_SERVICE_ENV", "production")
    monkeypatch.setenv("ROUTING_MATRIX_PROVIDER", "estimated")
    with pytest.raises(MatrixProviderError):
        validate_matrix_config()

    monkeypatch.setenv("ROUTING_MATRIX_PROVIDER", "osrm")
    monkeypatch.setenv("ROUTING_MATRIX_BASE_URL", "https://router.project-osrm.org")
    with pytest.raises(MatrixProviderError):
        validate_matrix_config()
