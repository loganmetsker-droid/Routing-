from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


OptimizationObjective = Literal["speed", "distance", "balanced"]


def normalize_objective(value: str | None) -> OptimizationObjective:
    normalized = (value or "distance").strip().lower()
    if normalized in {"speed", "time"}:
        return "speed"
    if normalized in {"balanced", "balance", "sla"}:
        return "balanced"
    if normalized == "distance":
        return "distance"
    raise ValueError("objective must be one of: speed, distance, balanced")


class VehicleInput(BaseModel):
    id: str
    start_lat: float
    start_lng: float
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    capacity_weight: float = 0
    capacity_volume: float = 0
    max_route_minutes: int = 480


class StopInput(BaseModel):
    id: str
    lat: float
    lng: float
    service_minutes: int = 10
    tw_start: Optional[datetime] = None
    tw_end: Optional[datetime] = None
    priority: int = 3
    weight: float = 0
    volume: float = 0
    locked_vehicle_id: Optional[str] = None


class OptimizeRequest(BaseModel):
    plan_date: datetime
    depot_id: Optional[str] = None
    objective: OptimizationObjective = "distance"
    vehicles: List[VehicleInput]
    stops: List[StopInput]

    @field_validator("objective", mode="before")
    @classmethod
    def validate_objective(cls, value: str | None) -> OptimizationObjective:
        return normalize_objective(value)


class RouteStopOutput(BaseModel):
    stop_id: str
    sequence: int
    eta: Optional[datetime] = None


class RouteOutput(BaseModel):
    vehicle_id: str
    ordered_stops: List[RouteStopOutput]
    total_distance_m: float
    total_duration_s: float


class OptimizeResponse(BaseModel):
    routes: List[RouteOutput]
    objective_used: OptimizationObjective = "distance"
    unassigned_stop_ids: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
