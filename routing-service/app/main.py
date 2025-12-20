"""FastAPI application for route optimization service."""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape
from datetime import datetime
import logging

from app.database import get_db
from app.models import Vehicle, Job
from app.solver import solve_vrp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Routing Optimization Service",
    description="Google OR-Tools based route optimization microservice",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class RouteRequest(BaseModel):
    """Request model for route optimization."""
    vehicle_id: str = Field(..., description="UUID of the vehicle")
    job_ids: List[str] = Field(..., description="List of job UUIDs to include in route")

    class Config:
        json_schema_extra = {
            "example": {
                "vehicle_id": "550e8400-e29b-41d4-a716-446655440000",
                "job_ids": [
                    "660e8400-e29b-41d4-a716-446655440001",
                    "660e8400-e29b-41d4-a716-446655440002",
                    "660e8400-e29b-41d4-a716-446655440003"
                ]
            }
        }


class JobInRoute(BaseModel):
    """Job information in optimized route."""
    job_id: str
    sequence: int
    location: dict
    estimated_arrival: str
    time_window_start: str
    time_window_end: str
    priority: int


class RouteResponse(BaseModel):
    """Response model for optimized route."""
    success: bool
    route: List[JobInRoute]
    total_distance_km: float
    total_duration_minutes: float
    num_jobs: int
    vehicle_start_location: dict
    error: Optional[str] = None


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Routing Optimization Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/route", response_model=RouteResponse)
async def optimize_route(
    request: RouteRequest,
    db: Session = Depends(get_db)
):
    """
    Optimize route for a vehicle and set of jobs using Google OR-Tools.

    This endpoint:
    1. Fetches vehicle and job data from PostgreSQL
    2. Runs VRP solver with time windows and priorities
    3. Returns optimized job sequence with estimated times

    Args:
        request: RouteRequest with vehicle_id and job_ids
        db: Database session

    Returns:
        RouteResponse with optimized route information
    """
    try:
        logger.info(f"Optimizing route for vehicle {request.vehicle_id} with {len(request.job_ids)} jobs")

        # Fetch vehicle from database
        vehicle = db.query(Vehicle).filter(Vehicle.id == request.vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Vehicle {request.vehicle_id} not found")

        # Get vehicle's current location
        if not vehicle.current_location:
            raise HTTPException(
                status_code=400,
                detail=f"Vehicle {request.vehicle_id} has no current location set"
            )

        # Extract vehicle location from PostGIS geometry
        vehicle_geom = to_shape(vehicle.current_location)
        vehicle_location = (vehicle_geom.y, vehicle_geom.x)  # (latitude, longitude)

        # Fetch jobs from database
        jobs = db.query(Job).filter(Job.id.in_(request.job_ids)).all()

        if len(jobs) != len(request.job_ids):
            found_ids = {str(job.id) for job in jobs}
            missing_ids = set(request.job_ids) - found_ids
            raise HTTPException(
                status_code=404,
                detail=f"Jobs not found: {', '.join(missing_ids)}"
            )

        # Prepare data for solver
        job_locations = []
        job_ids = []
        time_windows = []
        priorities = []

        priority_map = {
            'urgent': 1,
            'high': 2,
            'normal': 3,
            'low': 4
        }

        for job in jobs:
            # Extract delivery location
            if not job.delivery_location:
                raise HTTPException(
                    status_code=400,
                    detail=f"Job {job.id} has no delivery location set"
                )

            delivery_geom = to_shape(job.delivery_location)
            job_locations.append((delivery_geom.y, delivery_geom.x))
            job_ids.append(str(job.id))

            # Time windows
            time_windows.append((job.time_window_start, job.time_window_end))

            # Priority (convert to numeric)
            priority_value = priority_map.get(job.priority, 3)
            priorities.append(priority_value)

        # Validate we have at least one job
        if len(job_locations) == 0:
            raise HTTPException(status_code=400, detail="No valid jobs to optimize")

        # Run OR-Tools solver
        logger.info(f"Running VRP solver with {len(job_locations)} locations")
        result = solve_vrp(
            vehicle_location=vehicle_location,
            job_locations=job_locations,
            job_ids=job_ids,
            time_windows=time_windows,
            priorities=priorities
        )

        logger.info(f"Optimization complete. Success: {result['success']}")

        return RouteResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error optimizing route: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, db: Session = Depends(get_db)):
    """Get vehicle information by ID."""
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return {
        "id": str(vehicle.id),
        "make": vehicle.make,
        "model": vehicle.model,
        "license_plate": vehicle.license_plate,
        "status": vehicle.status,
        "vehicle_type": vehicle.vehicle_type
    }


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, db: Session = Depends(get_db)):
    """Get job information by ID."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": str(job.id),
        "customer_name": job.customer_name,
        "pickup_address": job.pickup_address,
        "delivery_address": job.delivery_address,
        "status": job.status,
        "priority": job.priority,
        "time_window_start": job.time_window_start.isoformat() if job.time_window_start else None,
        "time_window_end": job.time_window_end.isoformat() if job.time_window_end else None
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
