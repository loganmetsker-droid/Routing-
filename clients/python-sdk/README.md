# Routing & Dispatch Python SDK

Official Python client library for the Routing & Dispatch SaaS API.

## Installation

```bash
pip install routing-dispatch-sdk
```

## Quick Start

```python
from routing_dispatch_sdk import RoutingClient, DispatchClient

# Initialize clients
routing = RoutingClient(api_key="your-api-key-here")
dispatch = DispatchClient(api_key="your-api-key-here")

# Plan a route
route = routing.plan_route(
    vehicle_id="vehicle-123",
    job_ids=["job-1", "job-2", "job-3"]
)

print(f"Route distance: {route['totalDistance']}km")
print(f"Estimated duration: {route['totalDuration']}min")

# Assign routes to drivers
result = dispatch.assign_routes([
    {"routeId": route['id'], "driverId": "driver-456"}
])

print(f"Dispatch created: {result['dispatches'][0]['id']}")
```

## Features

- **Route Planning**: Optimize routes for vehicles and jobs
- **Dispatch Management**: Assign routes to drivers
- **Real-time Tracking**: Monitor vehicle locations
- **Error Handling**: Comprehensive exception handling
- **Type Hints**: Full type annotation support

## Usage Examples

### Routing Client

```python
from routing_dispatch_sdk import RoutingClient

client = RoutingClient(
    api_key="your-api-key",
    base_url="https://api.routingdispatch.com/api"  # Optional
)

# Plan an optimized route
route = client.plan_route(
    vehicle_id="v-123",
    job_ids=["j-1", "j-2", "j-3"],
    optimize=True,
    start_location={"lat": 40.7128, "lng": -74.0060},
    end_location={"lat": 40.7580, "lng": -73.9855}
)

# Get route details
route_details = client.get_route(route_id="route-123")

# List all routes
routes = client.list_routes(
    vehicle_id="v-123",
    status="planned",
    limit=10
)

# Calculate distance between points
distance_data = client.calculate_distance(
    origin={"lat": 40.7128, "lng": -74.0060},
    destination={"lat": 40.7580, "lng": -73.9855},
    waypoints=[
        {"lat": 40.7489, "lng": -73.9680}
    ]
)
```

### Dispatch Client

```python
from routing_dispatch_sdk import DispatchClient

client = DispatchClient(api_key="your-api-key")

# Create a dispatch
dispatch = client.create_dispatch(
    route_id="route-123",
    driver_id="driver-456",
    vehicle_id="vehicle-789",
    scheduled_start="2025-01-20T09:00:00Z",
    notes="Priority delivery"
)

# List dispatches
dispatches = client.list_dispatches(
    driver_id="driver-456",
    status="in_progress",
    date="2025-01-20"
)

# Update dispatch status
updated = client.update_dispatch_status(
    dispatch_id="dispatch-123",
    status="completed",
    notes="All deliveries successful"
)

# Get driver schedule
schedule = client.get_driver_schedule(
    driver_id="driver-456",
    start_date="2025-01-20",
    end_date="2025-01-27"
)

# Cancel a dispatch
canceled = client.cancel_dispatch(
    dispatch_id="dispatch-123",
    reason="Customer request"
)
```

## Error Handling

```python
from routing_dispatch_sdk import (
    RoutingClient,
    AuthenticationError,
    ValidationError,
    NotFoundError,
    RateLimitError,
    RoutingDispatchError
)

client = RoutingClient(api_key="your-key")

try:
    route = client.plan_route(
        vehicle_id="v-123",
        job_ids=["j-1", "j-2"]
    )
except AuthenticationError:
    print("Invalid API key")
except ValidationError as e:
    print(f"Validation failed: {e.errors}")
except NotFoundError:
    print("Resource not found")
except RateLimitError as e:
    print(f"Rate limit exceeded. Retry after {e.retry_after}s")
except RoutingDispatchError as e:
    print(f"API error: {e.message} (status: {e.status_code})")
```

## Configuration

### Environment Variables

```bash
export ROUTING_DISPATCH_API_KEY="your-api-key"
export ROUTING_DISPATCH_BASE_URL="https://api.routingdispatch.com/api"
```

### Custom Configuration

```python
import os
from routing_dispatch_sdk import RoutingClient

client = RoutingClient(
    api_key=os.getenv("ROUTING_DISPATCH_API_KEY"),
    base_url=os.getenv("ROUTING_DISPATCH_BASE_URL"),
    timeout=60  # Request timeout in seconds
)
```

## Development

```bash
# Clone repository
git clone https://github.com/your-org/routing-dispatch-sdk-python
cd routing-dispatch-sdk-python

# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run linter
flake8 routing_dispatch_sdk

# Format code
black routing_dispatch_sdk

# Type check
mypy routing_dispatch_sdk
```

## Requirements

- Python 3.8+
- requests >= 2.31.0

## License

MIT License - see LICENSE file for details

## Support

- Documentation: https://docs.routingdispatch.com/python-sdk
- Issues: https://github.com/your-org/routing-dispatch-sdk-python/issues
- Email: support@routingdispatch.com
