"""FastAPI application for route optimization service."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Dict, List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Job, Vehicle
from app.schemas import OptimizeRequest, OptimizeResponse
from app.solver import solve_optimize_request

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Routing Optimization Service",
    description="Google OR-Tools based route optimization microservice",
    version="2.0.0",
)


def get_allowed_origins() -> List[str]:
    configured = os.getenv("CORS_ORIGINS", "")
    if configured.strip():
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return ["http://localhost:3000", "http://localhost:5173"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.get("/")
async def root():
    return {
        "service": "Routing Optimization Service",
        "version": "2.0.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize(request: OptimizeRequest):
    logger.info(
        "Optimizing %s stops across %s vehicles",
        len(request.stops),
        len(request.vehicles),
    )
    try:
        return solve_optimize_request(request)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Optimizer failure: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _priority_to_number(priority: str | None) -> int:
    mapping = {"urgent": 1, "high": 2, "normal": 3, "low": 4}
    return mapping.get((priority or "normal").lower(), 3)


def _vehicle_to_schema(vehicle: Vehicle) -> Dict[str, object]:
    if not vehicle.current_location:
        raise HTTPException(
            status_code=400,
            detail=f"Vehicle {vehicle.id} has no current location set",
        )
    geom = to_shape(vehicle.current_location)
    return {
        "id": str(vehicle.id),
        "start_lat": geom.y,
        "start_lng": geom.x,
        "capacity_volume": float(vehicle.capacity_volume_m3 or 0),
        "max_route_minutes": 480,
    }


def _job_to_schema(job: Job) -> Dict[str, object]:
    if not job.delivery_location:
        raise HTTPException(
            status_code=400,
            detail=f"Job {job.id} has no delivery location set",
        )
    geom = to_shape(job.delivery_location)
    return {
        "id": str(job.id),
        "lat": geom.y,
        "lng": geom.x,
        "service_minutes": int(float(job.estimated_duration or 10)),
        "tw_start": job.time_window_start,
        "tw_end": job.time_window_end,
        "priority": _priority_to_number(job.priority),
        "volume": float(job.volume or 0),
    }


def _map_legacy_route(route, jobs_by_id: Dict[str, Job]):
    ordered = []
    for stop in route.ordered_stops:
        job = jobs_by_id[stop.stop_id]
        geom = to_shape(job.delivery_location)
        ordered.append(
            {
                "job_id": stop.stop_id,
                "sequence": stop.sequence,
                "location": {
                    "latitude": geom.y,
                    "longitude": geom.x,
                },
                "estimated_arrival": stop.eta.isoformat() if stop.eta else None,
                "time_window_start": job.time_window_start.isoformat()
                if job.time_window_start
                else None,
                "time_window_end": job.time_window_end.isoformat()
                if job.time_window_end
                else None,
                "priority": _priority_to_number(job.priority),
            }
        )
    return ordered


@app.post("/route")
async def optimize_route(request: Dict[str, List[str] | str], db: Session = Depends(get_db)):
    vehicle_id = str(request.get("vehicle_id", ""))
    job_ids = [str(job_id) for job_id in request.get("job_ids", [])]
    if not vehicle_id or not job_ids:
        raise HTTPException(status_code=400, detail="vehicle_id and job_ids are required")

    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found")

    jobs = db.query(Job).filter(Job.id.in_(job_ids)).all()
    if len(jobs) != len(job_ids):
        found_ids = {str(job.id) for job in jobs}
        missing = [job_id for job_id in job_ids if job_id not in found_ids]
        raise HTTPException(status_code=404, detail=f"Jobs not found: {', '.join(missing)}")

    optimize_request = OptimizeRequest(
        plan_date=min((job.time_window_start for job in jobs if job.time_window_start), default=datetime.utcnow()),
        vehicles=[_vehicle_to_schema(vehicle)],
        stops=[_job_to_schema(job) for job in jobs],
    )
    result = solve_optimize_request(optimize_request)
    route = next((route for route in result.routes if route.vehicle_id == vehicle_id), None)
    if not route:
        return {
            "success": False,
            "route": [],
            "total_distance_km": 0,
            "total_duration_minutes": 0,
            "num_jobs": 0,
            "vehicle_start_location": {
                "latitude": optimize_request.vehicles[0].start_lat,
                "longitude": optimize_request.vehicles[0].start_lng,
            },
            "error": "No feasible route returned",
            "warnings": result.warnings,
            "dropped_jobs": result.unassigned_stop_ids,
            "data_quality": "degraded",
            "optimization_status": "failed",
        }

    jobs_by_id = {str(job.id): job for job in jobs}
    return {
        "success": True,
        "route": _map_legacy_route(route, jobs_by_id),
        "total_distance_km": round(route.total_distance_m / 1000, 2),
        "total_duration_minutes": round(route.total_duration_s / 60, 2),
        "num_jobs": len(route.ordered_stops),
        "vehicle_start_location": {
            "latitude": optimize_request.vehicles[0].start_lat,
            "longitude": optimize_request.vehicles[0].start_lng,
        },
        "warnings": result.warnings,
        "dropped_jobs": result.unassigned_stop_ids,
        "data_quality": "live",
        "optimization_status": "optimized",
    }


@app.post("/route/global")
async def optimize_global_route(
    request: Dict[str, List[str]],
    db: Session = Depends(get_db),
):
    vehicle_ids = [str(vehicle_id) for vehicle_id in request.get("vehicle_ids", [])]
    job_ids = [str(job_id) for job_id in request.get("job_ids", [])]
    if not vehicle_ids or not job_ids:
        raise HTTPException(status_code=400, detail="vehicle_ids and job_ids are required")

    vehicles = db.query(Vehicle).filter(Vehicle.id.in_(vehicle_ids)).all()
    if not vehicles:
        raise HTTPException(status_code=400, detail="No active vehicles found")

    jobs = db.query(Job).filter(Job.id.in_(job_ids)).all()
    if not jobs:
        raise HTTPException(status_code=400, detail="No valid jobs to optimize")

    optimize_request = OptimizeRequest(
        plan_date=min((job.time_window_start for job in jobs if job.time_window_start), default=datetime.utcnow()),
        vehicles=[_vehicle_to_schema(vehicle) for vehicle in vehicles],
        stops=[_job_to_schema(job) for job in jobs],
    )
    result = solve_optimize_request(optimize_request)
    jobs_by_id = {str(job.id): job for job in jobs}
    vehicle_lookup = {str(vehicle.id): vehicle for vehicle in vehicles}
    routes: Dict[str, Dict[str, object]] = {}

    for route in result.routes:
        vehicle_schema = next(
            vehicle
            for vehicle in optimize_request.vehicles
            if vehicle.id == route.vehicle_id
        )
        vehicle = vehicle_lookup[route.vehicle_id]
        routes[route.vehicle_id] = {
            "route": _map_legacy_route(route, jobs_by_id),
            "total_distance_km": round(route.total_distance_m / 1000, 2),
            "total_duration_minutes": round(route.total_duration_s / 60, 2),
            "num_jobs": len(route.ordered_stops),
            "vehicle_start_location": {
                "latitude": vehicle_schema.start_lat,
                "longitude": vehicle_schema.start_lng,
            },
            "data_quality": "live",
            "optimization_status": "optimized",
            "warnings": result.warnings,
            "dropped_jobs": result.unassigned_stop_ids,
            "vehicle_label": getattr(vehicle, "license_plate", None),
        }

    return {
        "success": True,
        "routes": routes,
        "unassigned_jobs": result.unassigned_stop_ids,
        "warnings": result.warnings,
        "data_quality": "live",
        "optimization_status": "optimized",
    }
