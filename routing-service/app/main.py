"""FastAPI application for route optimization service."""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
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


class GlobalRouteRequest(BaseModel):
    """Request model for global multi-vehicle route optimization."""
    vehicle_ids: List[str] = Field(..., description="List of UUIDs of available vehicles")
    job_ids: List[str] = Field(..., description="List of unassigned job UUIDs to route")


class RouteInfo(BaseModel):
    route: List[JobInRoute]
    total_distance_km: float
    total_duration_minutes: float
    num_jobs: int
    vehicle_start_location: dict


class GlobalRouteResponse(BaseModel):
    """Response model for global multi-vehicle route optimization."""
    success: bool
    routes: Dict[str, RouteInfo]
    unassigned_jobs: List[str]
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
        job_volumes = []
        
        # Vehicle capacity: default to 10 if not set
        vehicle_capacity = float(vehicle.capacity_volume_m3) if vehicle.capacity_volume_m3 else 10.0

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

            # Volume constraints
            volume = float(job.volume) if job.volume else 1.0
            job_volumes.append(volume)

        # Validate we have at least one job
        if len(job_locations) == 0:
            raise HTTPException(status_code=400, detail="No valid jobs to optimize")

        # Run OR-Tools solver
        logger.info(f"Running VRP solver with {len(job_locations)} locations")
        result = solve_vrp(
            vehicle_locations=[vehicle_location],
            vehicle_ids=[request.vehicle_id],
            vehicle_capacities=[vehicle_capacity],
            job_locations=job_locations,
            job_ids=job_ids,
            time_windows=time_windows,
            priorities=priorities,
            job_volumes=job_volumes,
        )

        logger.info(f"Optimization complete. Success: {result['success']}")

        if not result['success']:
            return RouteResponse(
                success=False,
                route=[],
                total_distance_km=0,
                total_duration_minutes=0,
                num_jobs=0,
                vehicle_start_location={"latitude": vehicle_location[0], "longitude": vehicle_location[1]},
                error=result.get('error', 'Unknown error')
            )
            
        v_route = result['routes'].get(request.vehicle_id)
        if not v_route:
            return RouteResponse(
                success=False,
                route=[],
                total_distance_km=0,
                total_duration_minutes=0,
                num_jobs=0,
                vehicle_start_location={"latitude": vehicle_location[0], "longitude": vehicle_location[1]},
                error="Vehicle discarded by solver"
            )

        return RouteResponse(
            success=True,
            route=v_route['route'],
            total_distance_km=v_route['total_distance_km'],
            total_duration_minutes=v_route['total_duration_minutes'],
            num_jobs=v_route['num_jobs'],
            vehicle_start_location=v_route['vehicle_start_location']
        )


    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error optimizing route: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/route/global", response_model=GlobalRouteResponse)
async def optimize_global_route(
    request: GlobalRouteRequest,
    db: Session = Depends(get_db)
):
    """
    Optimize routes for multiple vehicles and a pool of unassigned jobs.
    """
    try:
        logger.info(f"Optimizing global route for {len(request.vehicle_ids)} vehicles and {len(request.job_ids)} jobs")

        vehicles = db.query(Vehicle).filter(Vehicle.id.in_(request.vehicle_ids)).all()
        if not vehicles:
            raise HTTPException(status_code=400, detail="No active vehicles found")

        vehicle_locations = []
        vehicle_ids = []
        vehicle_capacities = []
        
        for v in vehicles:
            if not v.current_location:
                continue
            geom = to_shape(v.current_location)
            vehicle_locations.append((geom.y, geom.x))
            vehicle_ids.append(str(v.id))
            cap = float(v.capacity_volume_m3) if v.capacity_volume_m3 else 10.0
            vehicle_capacities.append(cap)
            
        if not vehicle_locations:
            raise HTTPException(status_code=400, detail="No vehicles have current locations")

        jobs = db.query(Job).filter(Job.id.in_(request.job_ids)).all()
        
        job_locations = []
        job_ids = []
        time_windows = []
        priorities = []
        job_volumes = []
        
        priority_map = {'urgent': 1, 'high': 2, 'normal': 3, 'low': 4}
        
        for job in jobs:
            if not job.delivery_location:
                continue
            geom = to_shape(job.delivery_location)
            job_locations.append((geom.y, geom.x))
            job_ids.append(str(job.id))
            time_windows.append((job.time_window_start, job.time_window_end))
            priorities.append(priority_map.get(job.priority, 3))
            job_volumes.append(float(job.volume) if job.volume else 1.0)
            
        if not job_locations:
            raise HTTPException(status_code=400, detail="No valid jobs to optimize")
            
        result = solve_vrp(
            vehicle_locations=vehicle_locations,
            vehicle_ids=vehicle_ids,
            vehicle_capacities=vehicle_capacities,
            job_locations=job_locations,
            job_ids=job_ids,
            time_windows=time_windows,
            priorities=priorities,
            job_volumes=job_volumes,
        )
        
        if not result['success']:
            return GlobalRouteResponse(
                success=False,
                routes={},
                unassigned_jobs=job_ids,
                error=result.get('error', 'Unknown error')
            )
            
        return GlobalRouteResponse(
            success=True,
            routes=result['routes'],
            unassigned_jobs=result['unassigned_jobs']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error optimizing global route: {str(e)}", exc_info=True)
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
