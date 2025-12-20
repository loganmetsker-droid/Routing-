# Real-Time Vehicle Tracking System

Complete WebSocket-based real-time vehicle tracking with Leaflet map visualization.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TrackingGateway (WebSocket)  ← @Interval(30s)             │
│         ↓                                                    │
│  TrackingService                                            │
│         ↓                                                    │
│  PostgreSQL (telemetry table)                               │
│         ↓                                                    │
│  Query latest vehicle locations (PostGIS)                   │
│         ↓                                                    │
│  Broadcast to all WebSocket clients                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    WebSocket (Socket.IO)
                  namespace: /tracking
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React + Leaflet)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  socket.io-client  →  getTrackingSocket()                  │
│         ↓                                                    │
│  Listen: vehicle:locations                                  │
│         ↓                                                    │
│  Update state: vehicles[]                                   │
│         ↓                                                    │
│  Render: Leaflet map with vehicle markers                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Backend Implementation

### 1. Telemetry Entity

**File:** `backend/src/modules/tracking/entities/telemetry.entity.ts`

```typescript
@Entity('telemetry')
class Telemetry {
  vehicleId: UUID
  location: PostGIS Geography (POINT)
  speed: number (km/h)
  heading: number (degrees 0-360)
  timestamp: DateTime
  // ... more fields
}
```

### 2. TrackingService

**File:** `backend/src/modules/tracking/tracking.service.ts`

**Key Method:**
```typescript
async getLatestVehicleLocations(): Promise<VehicleLocation[]> {
  // SQL query with DISTINCT ON to get latest location per vehicle
  // Joins with vehicles table for metadata
  // Returns last hour of data
}
```

**SQL Query:**
```sql
WITH latest_telemetry AS (
  SELECT DISTINCT ON (vehicle_id)
    vehicle_id,
    ST_Y(location::geometry) as latitude,
    ST_X(location::geometry) as longitude,
    speed,
    heading,
    timestamp
  FROM telemetry
  WHERE timestamp > NOW() - INTERVAL '1 hour'
  ORDER BY vehicle_id, timestamp DESC
)
SELECT ...
FROM latest_telemetry
INNER JOIN vehicles ON ...
```

### 3. TrackingGateway

**File:** `backend/src/modules/tracking/tracking.gateway.ts`

**WebSocket Namespace:** `/tracking`

**Events Emitted (Server → Client):**
- `vehicle:locations` - Broadcast every 30 seconds
- `vehicle:location-update` - Single vehicle update
- `vehicle:history` - Historical location data

**Events Received (Client → Server):**
- `subscribe:locations` - Subscribe to broadcasts
- `get:vehicle-history` - Request history for specific vehicle
- `get:statistics` - Get telemetry statistics

**Auto-Broadcast:**
```typescript
@Interval(30000) // 30 seconds
async broadcastVehicleLocations() {
  const locations = await trackingService.getLatestVehicleLocations();
  server.emit('vehicle:locations', { vehicles: locations, ... });
}
```

**On Client Connect:**
```typescript
async handleConnection(client: Socket) {
  // Immediately send current locations
  const locations = await trackingService.getLatestVehicleLocations();
  client.emit('vehicle:locations', { vehicles: locations });
}
```

## Frontend Implementation

### 1. Socket.IO Client

**File:** `frontend/src/services/socket.ts`

```typescript
export const getTrackingSocket = (): Socket => {
  if (!trackingSocket) {
    trackingSocket = io(`${API_URL}/tracking`, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return trackingSocket;
};
```

### 2. VehicleMap Component

**File:** `frontend/src/components/tracking/VehicleMap.tsx`

**Features:**
- Leaflet map with OpenStreetMap tiles
- Custom vehicle icons (color-coded by status)
- Real-time marker updates
- Auto-fit bounds to show all vehicles
- Popup with vehicle details
- Connection status indicator
- Vehicle count display
- Last update timestamp

**Status Colors:**
- 🟢 Green - Available
- 🔵 Blue - In Route
- 🟠 Orange - Maintenance
- ⚫ Gray - Off Duty

**Map Controls:**
- Zoom in/out
- Click vehicle for details
- Auto-center on vehicles

### 3. TrackingPage

**File:** `frontend/src/pages/TrackingPage.tsx`

Full-screen page with:
- Header with title and refresh button
- Full-height map container
- Status panel with connection indicator

## Quick Start

### Option 1: Automated Setup (Recommended)

**Windows (MinGW64/Git Bash):**
```bash
./start-tracking-demo.bat
```

**macOS/Linux:**
```bash
./start-tracking-demo.sh
```

This script will:
1. Check Docker is running
2. Start PostgreSQL with PostGIS
3. Launch backend server in new window
4. Launch frontend server in new window
5. Display URLs to access the application

### Option 2: Manual Setup

#### 1. Start Infrastructure

```bash
cd infrastructure/docker
docker-compose -f docker-compose.dev.yml up -d postgres

# Wait for PostgreSQL to be ready
docker-compose -f docker-compose.dev.yml logs -f postgres
```

#### 2. Seed Sample Data (Optional)

```bash
# Connect to PostgreSQL
docker exec -it routing-dispatch-postgres psql -U postgres -d routing_dispatch

# Run seed script
\i /app/backend/scripts/seed-telemetry.sql

# Or copy from README if path doesn't work
```

Alternatively, use the SQL from `backend/scripts/seed-telemetry.sql`

#### 3. Start Backend

```bash
cd backend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# You should see:
# [Nest] INFO [TrackingGateway] WebSocket server initialized on /tracking namespace
```

Dependencies already added:
- `@nestjs/websockets`
- `@nestjs/platform-socket.io`
- `socket.io`
- `@nestjs/schedule`

#### 4. Start Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# You should see:
# VITE ready in XXXms
# Local: http://localhost:5173/
```

New dependency added:
- `socket.io-client`

#### 5. Access the Application

- **Frontend:** http://localhost:5173
- **Tracking Page:** http://localhost:5173/tracking
- **Backend API:** http://localhost:3000
- **GraphQL Playground:** http://localhost:3000/graphql

### Environment Configuration

Create `frontend/.env` (or copy from `.env.example`):
```bash
VITE_API_URL=http://localhost:3000
VITE_GRAPHQL_URL=http://localhost:3000/graphql
VITE_WS_URL=ws://localhost:3000
```

## Testing the System

### Quick Test

1. **Open the tracking page:**
   ```
   http://localhost:5173/tracking
   ```

2. **Check browser console:**
   ```
   ✅ Connected to vehicle tracking
   📍 Received 5 vehicle locations
   ```

3. **Verify map displays:**
   - Status panel shows "Connected" with green dot
   - Vehicle markers appear on map
   - Click markers to see vehicle details
   - Map auto-updates every 30 seconds

### Comprehensive Testing

For detailed testing instructions, see **[TESTING_GUIDE.md](./TESTING_GUIDE.md)**

The testing guide includes:
- ✅ Multiple testing methods (React app, HTML test page, browser console, cURL)
- ✅ Verification checklist for backend, frontend, and database
- ✅ Troubleshooting common issues
- ✅ Performance testing with multiple clients
- ✅ Load testing with large datasets

### Standalone WebSocket Test

Open the standalone test page in your browser:
```
file:///C:/Users/lmets/OneDrive/Desktop/my-awesome-project/test-tracking-websocket.html
```

This provides a simple UI to:
- Connect/disconnect from WebSocket
- Subscribe to location updates
- View real-time vehicle data
- Request statistics
- Monitor all events in a console log

### Manual WebSocket Test (Browser Console)

```javascript
// Connect to tracking namespace
const socket = io('http://localhost:3000/tracking');

socket.on('connect', () => console.log('✅ Connected!'));

socket.on('vehicle:locations', (data) => {
  console.log(`📍 Received ${data.count} vehicles:`, data.vehicles);
});

socket.emit('subscribe:locations');
```

## Database Schema

### Telemetry Table

```sql
CREATE TABLE telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  speed DECIMAL(5,2),
  heading DECIMAL(5,2),
  odometer DECIMAL(10,2),
  fuel_level DECIMAL(5,2),
  engine_temp DECIMAL(5,2),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB
);

CREATE INDEX idx_telemetry_vehicle_timestamp
  ON telemetry(vehicle_id, timestamp DESC);

CREATE INDEX idx_telemetry_timestamp
  ON telemetry(timestamp DESC);

-- TimescaleDB hypertable (if using TimescaleDB)
SELECT create_hypertable('telemetry', 'timestamp');
```

## WebSocket Events Reference

### Server → Client

**`vehicle:locations`**
```typescript
{
  vehicles: [
    {
      vehicleId: "uuid",
      latitude: 37.7749,
      longitude: -122.4194,
      speed: 45.5,
      heading: 180,
      timestamp: "2024-01-15T10:30:00Z",
      vehicleInfo: {
        licensePlate: "ABC-1234",
        make: "Ford",
        model: "Transit",
        status: "in_route",
        vehicleType: "van"
      }
    }
  ],
  timestamp: "2024-01-15T10:30:00Z",
  count: 5
}
```

**`vehicle:history`** (Response to get:vehicle-history)
```typescript
{
  vehicleId: "uuid",
  history: [
    { latitude, longitude, speed, heading, timestamp },
    ...
  ],
  count: 100
}
```

### Client → Server

**`subscribe:locations`**
```typescript
socket.emit('subscribe:locations');
// Response: { event: 'subscribed', data: { room: 'locations' } }
```

**`get:vehicle-history`**
```typescript
socket.emit('get:vehicle-history', {
  vehicleId: 'vehicle-uuid',
  hours: 24  // optional, default 24
});
```

**`get:statistics`**
```typescript
socket.emit('get:statistics');
// Response: { totalRecords, vehiclesTracked, oldestRecord, newestRecord }
```

## Performance Considerations

### Backend

- **Query Optimization**: Uses `DISTINCT ON` with indexes for fast latest-location queries
- **Broadcast Frequency**: 30 seconds (configurable)
- **Data Retention**: Queries only last 1 hour of telemetry
- **Connection Pooling**: Reuses database connections
- **Lazy Loading**: Only fetches data when clients are connected

### Frontend

- **Auto-Reconnect**: Socket.IO handles reconnection automatically
- **Efficient Updates**: Only re-renders when vehicle data changes
- **Map Performance**: Leaflet handles thousands of markers efficiently
- **Memory Management**: Cleans up socket listeners on unmount

## Customization

### Change Broadcast Frequency

`backend/src/modules/tracking/tracking.gateway.ts`:
```typescript
@Interval(60000) // Change to 60 seconds
async broadcastVehicleLocations() { ... }
```

### Change Map Center

`frontend/src/components/tracking/VehicleMap.tsx`:
```typescript
const defaultCenter: [number, number] = [40.7128, -74.0060]; // New York
```

### Customize Vehicle Icons

```typescript
const createVehicleIcon = (status: string, vehicleType: string) => {
  // Add custom logic based on vehicleType
  if (vehicleType === 'truck') {
    return L.icon({ iconUrl: '/truck-icon.png', ... });
  }
  ...
};
```

### Add More Map Layers

```typescript
<TileLayer
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>
<!-- Add satellite view -->
<TileLayer
  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
/>
```

## Troubleshooting

### No Vehicles Showing

1. **Check telemetry data exists:**
```sql
SELECT COUNT(*) FROM telemetry
WHERE timestamp > NOW() - INTERVAL '1 hour';
```

2. **Check WebSocket connection:**
```
Browser console should show: "✅ Connected to vehicle tracking"
```

3. **Check backend logs:**
```
Broadcasting vehicle locations to X clients
✅ Broadcast 5 vehicle locations
```

### Connection Issues

1. **CORS errors**: Update `@WebSocketGateway` cors config
2. **Port conflicts**: Change WebSocket port in gateway decorator
3. **Firewall**: Ensure port 3000 is accessible

### Map Not Loading

1. **Leaflet CSS**: Ensure `import 'leaflet/dist/leaflet.css'` is present
2. **Icon paths**: Check Vite static asset configuration
3. **Height**: Map container must have explicit height (not `height: auto`)

## Production Deployment

### Backend

1. **Enable clustering** for multiple workers
2. **Use Redis adapter** for Socket.IO (multi-server support)
3. **Add authentication** to WebSocket handshake
4. **Rate limiting** on socket events
5. **Monitor** connection counts and broadcast performance

### Frontend

1. **Use environment variables** for API URLs
2. **Implement error boundaries** around map component
3. **Add loading states** during initial connection
4. **Cache tile layers** for offline support
5. **Optimize bundle size** (lazy load Leaflet)

## Next Steps

1. **Vehicle Trail History**: Show path traveled over time
2. **Geofencing**: Alert when vehicles enter/exit zones
3. **Heatmap Layer**: Show high-traffic areas
4. **Route Visualization**: Display assigned routes on map
5. **Driver Photos**: Show driver avatars in popups
6. **Real-Time Notifications**: Alert for speeding, stops, etc.
7. **Mobile App**: React Native version with native maps

## License

MIT
