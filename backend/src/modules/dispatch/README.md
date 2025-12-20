# Dispatch Module

Automated route planning and dispatching service that integrates with the Python routing-service (Google OR-Tools) for optimal vehicle routing.

## Features

- **Auto-Dispatch Worker**: Runs every minute via `@Cron` to automatically assign pending jobs to available vehicles
- **Route Optimization**: Calls Python routing-service for Google OR-Tools VRP optimization
- **Real-Time Updates**: WebSocket gateway for live dispatch events
- **Vehicle Status Management**: Automatically updates vehicle status (`available` → `in_route`)
- **Route Lifecycle**: Full CRUD operations for routes with status transitions
- **Job Assignment**: Automatically assigns jobs to routes and updates their status

## Architecture

```
┌──────────────────┐
│  DispatchWorker  │  ← @Cron(every minute)
│  (Auto-Dispatch) │
└────────┬─────────┘
         │
         ├─ 1. Query pending jobs
         ├─ 2. Find available vehicles
         ├─ 3. Call routing-service (Python OR-Tools)
         ├─ 4. Create Route entities
         ├─ 5. Update vehicle.status → "in_route"
         └─ 6. Emit WebSocket events
```

## Core Components

### 1. Route Entity

Stores optimized routes with job sequences:

```typescript
{
  id: UUID
  vehicleId: UUID
  driverId: UUID (optional)
  jobIds: string[]  // Optimized sequence from OR-Tools
  routeData: JSON   // Full optimization response
  status: 'planned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  totalDistanceKm: number
  totalDurationMinutes: number
  jobCount: number
  plannedStart: Date
  actualStart: Date
  completedAt: Date
}
```

### 2. DispatchService

**Key Methods:**

- `create(dto)` - Create route with optimization via routing-service
- `startRoute(id)` - Start route (vehicle → "in_route", jobs → "assigned")
- `completeRoute(id)` - Complete route (vehicle → "available")
- `cancelRoute(id)` - Cancel route (jobs → "pending")
- `callRoutingService(vehicleId, jobIds)` - HTTP call to Python service

### 3. DispatchWorker

**Auto-Dispatch Cron Job** (runs every minute):

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async handleAutoDispatch() {
  // 1. Get pending jobs (prioritized by urgency + time window)
  // 2. Get available vehicles
  // 3. Distribute jobs across vehicles (round-robin MVP)
  // 4. For each vehicle:
  //    - Call routing-service for optimization
  //    - Create route
  //    - Start route
  //    - Emit WebSocket events
}
```

### 4. DispatchGateway

**WebSocket Events** (namespace: `/dispatch`):

**Client → Server:**
- `subscribe:routes` - Subscribe to route updates
- `subscribe:vehicles` - Subscribe to vehicle updates

**Server → Client:**
- `route:created` - New route created
- `route:started` - Route started
- `route:completed` - Route completed
- `vehicle:status-update` - Vehicle status changed
- `job:assigned` - Job assigned to route

## REST API Endpoints

### Routes

```
POST   /api/dispatch/routes               - Create optimized route
GET    /api/dispatch/routes               - List routes (?status=planned)
GET    /api/dispatch/routes/statistics    - Get route statistics
GET    /api/dispatch/routes/:id           - Get route by ID
GET    /api/dispatch/vehicles/:id/routes  - Get routes for vehicle
PUT    /api/dispatch/routes/:id           - Update route
PATCH  /api/dispatch/routes/:id/start     - Start route
PATCH  /api/dispatch/routes/:id/complete  - Complete route
PATCH  /api/dispatch/routes/:id/cancel    - Cancel route
POST   /api/dispatch/auto-dispatch        - Manual trigger (testing)
```

## Usage Examples

### 1. Manual Route Creation

```bash
curl -X POST http://localhost:3000/api/dispatch/routes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "vehicleId": "550e8400-e29b-41d4-a716-446655440000",
    "jobIds": [
      "660e8400-e29b-41d4-a716-446655440001",
      "660e8400-e29b-41d4-a716-446655440002"
    ],
    "plannedStart": "2024-01-15T09:00:00Z"
  }'
```

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "vehicleId": "550e8400-e29b-41d4-a716-446655440000",
  "jobIds": ["660e8400-...-001", "660e8400-...-002"],
  "status": "planned",
  "totalDistanceKm": 25.5,
  "totalDurationMinutes": 38.25,
  "jobCount": 2,
  "routeData": {
    "success": true,
    "route": [/* optimized sequence */]
  }
}
```

### 2. Start Route

```bash
curl -X PATCH http://localhost:3000/api/dispatch/routes/770e8400.../start \
  -H "Authorization: Bearer <token>"
```

This will:
- Update route status: `planned` → `in_progress`
- Update vehicle status: `available` → `in_route`
- Update job statuses: `pending` → `assigned`
- Emit WebSocket event: `route:started`

### 3. Complete Route

```bash
curl -X PATCH http://localhost:3000/api/dispatch/routes/770e8400.../complete \
  -H "Authorization: Bearer <token>"
```

This will:
- Update route status: `in_progress` → `completed`
- Update vehicle status: `in_route` → `available`
- Emit WebSocket event: `route:completed`

### 4. Manual Dispatch Trigger (Testing)

```bash
curl -X POST http://localhost:3000/api/dispatch/auto-dispatch \
  -H "Authorization: Bearer <token>"
```

Manually triggers the auto-dispatch worker immediately.

## WebSocket Integration

### Connect to Dispatch Gateway

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/dispatch', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Subscribe to route updates
socket.emit('subscribe:routes');

// Listen for events
socket.on('route:created', (data) => {
  console.log('New route created:', data);
  // { routeId, vehicleId, jobCount, status, totalDistanceKm, ... }
});

socket.on('route:started', (data) => {
  console.log('Route started:', data);
  // { routeId, vehicleId, status, actualStart }
});

socket.on('vehicle:status-update', (data) => {
  console.log('Vehicle status updated:', data);
  // { vehicleId, status, routeId }
});
```

## Configuration

### Environment Variables

```bash
# .env
ROUTING_SERVICE_URL=http://localhost:8000
```

### Dependencies

The module requires:
- `@nestjs/axios` - HTTP client for routing-service calls
- `@nestjs/schedule` - Cron job support
- `@nestjs/websockets` - WebSocket gateway
- `@nestjs/platform-socket.io` - Socket.IO platform
- `socket.io` - WebSocket library

## Auto-Dispatch Algorithm (MVP)

**Current Implementation (Simple Round-Robin):**

1. Fetch pending jobs (max 50), ordered by:
   - Priority (urgent → high → normal → low)
   - Time window start (earliest first)

2. Fetch available vehicles (max 10)

3. Distribute jobs evenly across vehicles:
   ```
   jobsPerVehicle = ceil(totalJobs / totalVehicles)
   ```

4. For each vehicle:
   - Assign next `jobsPerVehicle` jobs
   - Call routing-service for optimization
   - Create route with optimized sequence
   - Start route immediately

**Future Enhancements:**
- Multi-depot routing
- Vehicle capacity constraints (weight/volume)
- Driver skill matching
- Geographic clustering
- Time window tightness scoring
- Re-optimization for failed routes

## Workflow Example

### Auto-Dispatch Cycle (Every Minute)

```
T+0s:   Worker wakes up
T+1s:   Queries DB: 15 pending jobs, 3 available vehicles
T+2s:   Job distribution: Vehicle A (5 jobs), Vehicle B (5 jobs), Vehicle C (5 jobs)
T+3s:   Call routing-service for Vehicle A
T+8s:   Receive optimized route for Vehicle A → Create Route entity
T+9s:   Start route → Vehicle A status = "in_route"
T+10s:  Emit WebSocket: route:created, vehicle:status-update
T+11s:  Call routing-service for Vehicle B
T+16s:  Receive optimized route for Vehicle B → Create Route entity
T+17s:  Start route → Vehicle B status = "in_route"
...
T+30s:  All routes created and started
T+31s:  Worker completes, sleeps until next minute
```

## Database Schema

The module uses existing tables:
- `routes` - New table created by Route entity
- `vehicles` - Updates `status` field
- `jobs` - Updates `status` and `assigned_route_id` fields

### Migration Required

```sql
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  job_ids JSONB NOT NULL,
  route_data JSONB,
  status VARCHAR(20) DEFAULT 'planned',
  total_distance_km DECIMAL(10,2),
  total_duration_minutes DECIMAL(10,2),
  job_count INTEGER DEFAULT 0,
  planned_start TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_routes_status ON routes(status, created_at);
CREATE INDEX idx_routes_vehicle ON routes(vehicle_id);
```

## Error Handling

- **No Available Vehicles**: Worker logs warning, skips cycle
- **No Pending Jobs**: Worker logs debug, skips cycle
- **Routing Service Failure**: Logs error, continues with next vehicle
- **Invalid Job IDs**: Returns 404 error
- **Jobs Not Pending**: Returns 400 error
- **Vehicle Not Found**: Returns 404 error

## Monitoring & Logging

The worker logs:
- `🔄 Running auto-dispatch worker` - Start of cycle
- `Found X pending jobs` - Job count
- `Found X available vehicles` - Vehicle count
- `Creating optimized route for vehicle X` - Per-vehicle optimization
- `✅ Route X created and started` - Success per vehicle
- `✅ Auto-dispatch complete. Created X routes` - End of cycle
- Errors with stack traces

## Testing

```typescript
// Manual dispatch trigger
POST /api/dispatch/auto-dispatch

// Check worker execution
GET /api/dispatch/routes?status=in_progress

// Monitor WebSocket events
// Connect to ws://localhost:3000/dispatch
```

## Performance Considerations

- **Worker Frequency**: Every minute (configurable via `@Cron`)
- **Batch Size**: Max 50 jobs, 10 vehicles per cycle
- **Routing Timeout**: 30 seconds per HTTP request
- **Database Queries**: Indexed by status + created_at
- **WebSocket**: Broadcasts only to subscribed rooms

## Security

- All endpoints require JWT authentication (except WebSocket handshake)
- Use `@Public()` decorator to bypass auth if needed
- WebSocket namespace: `/dispatch` (isolated from other gateways)
- Input validation via `class-validator` DTOs

## Future Roadmap

1. **Advanced Algorithms**:
   - Vehicle capacity constraints
   - Driver shift scheduling
   - Multi-depot optimization
   - Dynamic re-routing

2. **Real-Time Tracking**:
   - Live vehicle location updates
   - ETA calculations
   - Route progress monitoring

3. **Analytics**:
   - Route efficiency metrics
   - Vehicle utilization reports
   - On-time delivery rates

4. **Notifications**:
   - Driver mobile app integration
   - Customer SMS/email updates
   - Alert system for delays
