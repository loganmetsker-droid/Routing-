from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class VehicleInput(BaseModel):
    id: str
    start_lat: float
    start_lng: float
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
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
    volume: float = 0
    locked_vehicle_id: Optional[str] = None


class OptimizeRequest(BaseModel):
    plan_date: datetime
    depot_id: Optional[str] = None
    vehicles: List[VehicleInput]
    stops: List[StopInput]


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
    unassigned_stop_ids: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
