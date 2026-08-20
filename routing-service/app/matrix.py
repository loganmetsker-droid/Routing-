"""Road-network matrix providers for the optimizer."""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import List, Literal, Tuple

import requests


LatLng = Tuple[float, float]
MatrixMode = Literal["road_network", "estimated"]
HOSTED_ENVIRONMENTS = {"staging", "production", "prod"}
PUBLIC_OSRM_HOST = "router.project-osrm.org"


class MatrixProviderError(RuntimeError):
    """Raised when a configured provider cannot return a safe matrix."""


@dataclass(frozen=True)
class MatrixResult:
    distance_m: List[List[int]]
    duration_s: List[List[int]]
    provider: str
    mode: MatrixMode
    fallback_used: bool
    warning: str | None = None


def is_hosted_environment() -> bool:
    environment = (
        os.getenv("ROUTING_SERVICE_ENV")
        or os.getenv("NODE_ENV")
        or os.getenv("ENV")
        or ""
    )
    return environment.lower() in HOSTED_ENVIRONMENTS


def calculate_distance_km(origin: LatLng, destination: LatLng) -> float:
    lat1, lon1 = origin
    lat2, lon2 = destination
    radius_km = 6371.0
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    dlat = math.radians(lat2 - lat1)
    value = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    )
    arc = 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))
    return radius_km * arc


def estimate_segment_speed_kph(km: float) -> float:
    if km < 2:
        return 20.0
    if km < 8:
        return 30.0
    if km < 20:
        return 42.0
    return 58.0


def build_estimated_matrices(locations: List[LatLng]) -> MatrixResult:
    distance_matrix: List[List[int]] = []
    duration_matrix: List[List[int]] = []
    for origin_index, origin in enumerate(locations):
        distance_row: List[int] = []
        duration_row: List[int] = []
        for destination_index, destination in enumerate(locations):
            if origin_index == destination_index:
                distance_row.append(0)
                duration_row.append(0)
                continue
            km = calculate_distance_km(origin, destination)
            distance_row.append(int(km * 1000))
            duration_row.append(int((km / estimate_segment_speed_kph(km)) * 3600))
        distance_matrix.append(distance_row)
        duration_matrix.append(duration_row)
    return MatrixResult(
        distance_m=distance_matrix,
        duration_s=duration_matrix,
        provider="trovan-estimated",
        mode="estimated",
        fallback_used=True,
        warning="Road-network matrix unavailable; straight-line estimates were used.",
    )


def _validated_matrix(value: object, size: int, label: str) -> List[List[int]]:
    if not isinstance(value, list) or len(value) != size:
        raise MatrixProviderError(f"{label} matrix has the wrong row count")
    matrix: List[List[int]] = []
    for row in value:
        if not isinstance(row, list) or len(row) != size:
            raise MatrixProviderError(f"{label} matrix has the wrong column count")
        normalized: List[int] = []
        for cell in row:
            if not isinstance(cell, (int, float)) or not math.isfinite(cell) or cell < 0:
                raise MatrixProviderError(f"{label} matrix contains an invalid value")
            normalized.append(int(round(cell)))
        matrix.append(normalized)
    return matrix


def validate_matrix_config() -> None:
    provider = os.getenv("ROUTING_MATRIX_PROVIDER", "estimated").strip().lower()
    if not is_hosted_environment():
        return
    if provider != "osrm":
        raise MatrixProviderError(
            "ROUTING_MATRIX_PROVIDER=osrm is required in hosted environments"
        )
    base_url = os.getenv("ROUTING_MATRIX_BASE_URL", "").strip()
    if not base_url:
        raise MatrixProviderError(
            "ROUTING_MATRIX_BASE_URL is required in hosted environments"
        )
    if PUBLIC_OSRM_HOST in base_url.lower():
        raise MatrixProviderError(
            "The public OSRM demo service is not permitted for hosted optimization"
        )


def fetch_osrm_matrix(locations: List[LatLng], *, session=requests) -> MatrixResult:
    base_url = os.getenv("ROUTING_MATRIX_BASE_URL", "").strip().rstrip("/")
    if not base_url:
        raise MatrixProviderError("ROUTING_MATRIX_BASE_URL is not configured")
    if is_hosted_environment() and PUBLIC_OSRM_HOST in base_url.lower():
        raise MatrixProviderError("Public OSRM demo use is disabled in hosted environments")

    coordinate_path = ";".join(
        f"{longitude:.6f},{latitude:.6f}" for latitude, longitude in locations
    )
    url = f"{base_url}/table/v1/driving/{coordinate_path}"
    token = os.getenv("ROUTING_MATRIX_TOKEN", "").strip()
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        configured_timeout = float(os.getenv("ROUTING_MATRIX_TIMEOUT_SECONDS", "8"))
    except ValueError as exc:
        raise MatrixProviderError("ROUTING_MATRIX_TIMEOUT_SECONDS is invalid") from exc
    timeout_seconds = max(1.0, min(configured_timeout, 30.0))

    try:
        response = session.get(
            url,
            params={"annotations": "duration,distance"},
            headers=headers,
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise MatrixProviderError("Road-matrix provider request failed") from exc

    if not isinstance(payload, dict) or payload.get("code") != "Ok":
        raise MatrixProviderError("Road-matrix provider returned an invalid response")

    size = len(locations)
    return MatrixResult(
        distance_m=_validated_matrix(payload.get("distances"), size, "distance"),
        duration_s=_validated_matrix(payload.get("durations"), size, "duration"),
        provider=os.getenv("ROUTING_MATRIX_PROVIDER_LABEL", "osrm").strip() or "osrm",
        mode="road_network",
        fallback_used=False,
    )


def resolve_route_matrices(locations: List[LatLng], *, session=requests) -> MatrixResult:
    provider = os.getenv("ROUTING_MATRIX_PROVIDER", "estimated").strip().lower()
    if provider == "osrm":
        try:
            return fetch_osrm_matrix(locations, session=session)
        except MatrixProviderError:
            allow_fallback = os.getenv(
                "ROUTING_MATRIX_ALLOW_FALLBACK",
                "false" if is_hosted_environment() else "true",
            ).strip().lower() in {"1", "true", "yes"}
            if not allow_fallback:
                raise
            return build_estimated_matrices(locations)
    if provider == "estimated" and not is_hosted_environment():
        return build_estimated_matrices(locations)
    raise MatrixProviderError(f"Unsupported routing matrix provider: {provider or 'unset'}")
