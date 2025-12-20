# Routing Optimization Service

Python microservice using **Google OR-Tools** for vehicle routing optimization with time windows and priority constraints.

## Features

- **VRP Solver**: Traveling Salesman Problem (TSP) solver for MVP
- **Time Windows**: Respects job delivery time windows
- **Priority Handling**: Prioritizes urgent/high-priority jobs
- **Distance Calculation**: Haversine formula for accurate lat/lon distances
- **FastAPI**: Modern async Python web framework
- **SQLAlchemy**: Direct PostgreSQL integration with TimescaleDB
- **Docker**: Containerized deployment

## Tech Stack

- **Python 3.11**
- **FastAPI** - Web framework
- **Google OR-Tools** - Constraint optimization solver
- **SQLAlchemy** - ORM for PostgreSQL
- **GeoAlchemy2** - PostGIS geographic data support
- **Pydantic** - Data validation
- **Uvicorn** - ASGI server

## Quick Start

### Using Docker Compose (Recommended)

```bash
# From project root
cd my-awesome-project

# Start all services (PostgreSQL, Redis, Routing Service)
docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d

# Check routing service logs
docker logs routing-dispatch-routing-service-dev

# Access the API
curl http://localhost:8000/health
```

### Local Development

```bash
cd routing-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/routing_dispatch

# Run the service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Optimize Route
```bash
POST /route
Content-Type: application/json

{
  "vehicle_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_ids": [
    "660e8400-e29b-41d4-a716-446655440001",
    "660e8400-e29b-41d4-a716-446655440002",
    "660e8400-e29b-41d4-a716-446655440003"
  ]
}
```

### Get Vehicle
```bash
GET /vehicles/{vehicle_id}
```

### Get Job
```bash
GET /jobs/{job_id}
```

## Example cURL Requests

### 1. Health Check
```bash
curl http://localhost:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000000"
}
```

### 2. Optimize Route (Full Example)
```bash
curl -X POST http://localhost:8000/route \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_ids": [
      "660e8400-e29b-41d4-a716-446655440001",
      "660e8400-e29b-41d4-a716-446655440002",
      "660e8400-e29b-41d4-a716-446655440003"
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "route": [
    {
      "job_id": "660e8400-e29b-41d4-a716-446655440001",
      "sequence": 1,
      "location": {
        "latitude": 37.7749,
        "longitude": -122.4194
      },
      "estimated_arrival": "2024-01-15T09:30:00",
      "time_window_start": "2024-01-15T09:00:00",
      "time_window_end": "2024-01-15T12:00:00",
      "priority": 1
    },
    {
      "job_id": "660e8400-e29b-41d4-a716-446655440003",
      "sequence": 2,
      "location": {
        "latitude": 37.8044,
        "longitude": -122.2712
      },
      "estimated_arrival": "2024-01-15T10:15:00",
      "time_window_start": "2024-01-15T10:00:00",
      "time_window_end": "2024-01-15T14:00:00",
      "priority": 2
    },
    {
      "job_id": "660e8400-e29b-41d4-a716-446655440002",
      "sequence": 3,
      "location": {
        "latitude": 37.8715,
        "longitude": -122.2730
      },
      "estimated_arrival": "2024-01-15T11:00:00",
      "time_window_start": "2024-01-15T11:00:00",
      "time_window_end": "2024-01-15T15:00:00",
      "priority": 3
    }
  ],
  "total_distance_km": 35.42,
  "total_duration_minutes": 53.13,
  "num_jobs": 3,
  "vehicle_start_location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  }
}
```

### 3. Get Vehicle Info
```bash
curl http://localhost:8000/vehicles/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "make": "Ford",
  "model": "Transit",
  "license_plate": "ABC-1234",
  "status": "available",
  "vehicle_type": "van"
}
```

### 4. Get Job Info
```bash
curl http://localhost:8000/jobs/660e8400-e29b-41d4-a716-446655440001
```

**Response:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "customer_name": "John Doe",
  "pickup_address": "123 Main St, San Francisco, CA",
  "delivery_address": "456 Market St, San Francisco, CA",
  "status": "pending",
  "priority": "urgent",
  "time_window_start": "2024-01-15T09:00:00",
  "time_window_end": "2024-01-15T12:00:00"
}
```

## How It Works

### 1. Data Fetching
- Service connects to PostgreSQL using SQLAlchemy
- Fetches vehicle current location and job delivery locations from PostGIS
- Extracts time windows and priority constraints

### 2. OR-Tools Optimization
- Creates distance matrix using Haversine formula (lat/lon → km)
- Sets up VRP model with:
  - **Distance callback**: Calculates cost between locations
  - **Time dimension**: Enforces time window constraints
  - **Priority penalties**: Soft constraints for job priority
- Runs **Guided Local Search** metaheuristic (10-second limit)

### 3. Solution Extraction
- Extracts optimized job sequence
- Calculates estimated arrival times
- Returns ordered route with timing and distance metrics

## Algorithm Details

### VRP Configuration
- **Strategy**: First Solution: PATH_CHEAPEST_ARC
- **Metaheuristic**: Guided Local Search
- **Time Limit**: 10 seconds
- **Constraints**: Hard time windows, soft priority constraints

### Distance Calculation
Uses Haversine formula for accurate great-circle distance:
```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1−a))
distance = R × c
```
Where R = 6371 km (Earth's radius)

### Priority Mapping
- Urgent: 1 (highest priority)
- High: 2
- Normal: 3
- Low: 4 (lowest priority)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/routing_dispatch` | PostgreSQL connection string |
| `PORT` | `8000` | Service port |
| `LOG_LEVEL` | `INFO` | Logging level |

## Development

### Project Structure
```
routing-service/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application
│   ├── database.py      # SQLAlchemy setup
│   ├── models.py        # Database models
│   └── solver.py        # OR-Tools VRP solver
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

### Running Tests
```bash
# TODO: Add pytest tests
pytest tests/
```

### API Documentation
Once the service is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Integration with NestJS Backend

The routing service can be called from the NestJS backend:

```typescript
// Example: Call routing service from NestJS
import { HttpService } from '@nestjs/axios';

async optimizeRoute(vehicleId: string, jobIds: string[]) {
  const response = await this.httpService.post(
    'http://routing-service:8000/route',
    { vehicle_id: vehicleId, job_ids: jobIds }
  ).toPromise();

  return response.data;
}
```

## Troubleshooting

### Common Issues

**1. "No solution found"**
- Check time windows are feasible
- Ensure vehicle location is set
- Verify job locations exist

**2. Database connection errors**
- Verify PostgreSQL is running
- Check DATABASE_URL is correct
- Ensure TimescaleDB extensions are enabled

**3. Import errors**
- Reinstall dependencies: `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.11+)

## License

MIT
