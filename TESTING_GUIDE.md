# Testing Guide - Real-Time Vehicle Tracking System

Complete guide to test the vehicle tracking WebSocket implementation.

## Prerequisites

1. **PostgreSQL with PostGIS** running (via Docker)
2. **Backend** NestJS server running
3. **Frontend** React dev server running
4. **Sample data** in database (vehicles + telemetry)

## Quick Start Testing

### 1. Start the Infrastructure

```bash
# Start PostgreSQL with PostGIS
cd infrastructure/docker
docker-compose -f docker-compose.dev.yml up -d postgres

# Wait for PostgreSQL to be ready
docker-compose -f docker-compose.dev.yml logs -f postgres
# Look for "database system is ready to accept connections"
```

### 2. Seed Sample Data

```bash
# Connect to PostgreSQL
docker exec -it routing-dispatch-postgres psql -U postgres -d routing_dispatch

# Run the telemetry seed script
\i /path/to/backend/scripts/seed-telemetry.sql

# Or manually insert sample data:
INSERT INTO telemetry (vehicle_id, location, speed, heading, timestamp)
SELECT
    v.id,
    ST_GeogFromText('POINT(' || (-122.4 + random() * 0.1)::text || ' ' || (37.75 + random() * 0.1)::text || ')'),
    (30 + random() * 50)::decimal(5,2),
    (random() * 360)::decimal(5,2),
    NOW() - (random() * interval '5 minutes')
FROM vehicles v
WHERE v.status IN ('available', 'in_route')
LIMIT 10;

# Exit psql
\q
```

### 3. Start Backend Server

```bash
cd backend

# Install dependencies (if not done)
npm install

# Start dev server
npm run dev

# You should see:
# [Nest] INFO [NestApplication] Nest application successfully started
# [Nest] INFO [TrackingGateway] WebSocket server listening on /tracking
```

### 4. Start Frontend Server

```bash
cd frontend

# Install dependencies (if not done)
npm install

# Start dev server
npm run dev

# You should see:
# VITE ready in XXXms
# Local: http://localhost:5173/
```

## Testing Methods

### Method 1: React Application (Recommended)

1. **Open the tracking page:**
   ```
   http://localhost:5173/tracking
   ```

2. **What to expect:**
   - Map should load with OpenStreetMap tiles
   - Status panel in top-left corner shows "Connected" with green dot
   - Vehicle count displayed
   - Colored markers on map (green=available, blue=in_route, etc.)
   - Map auto-fits to show all vehicles

3. **Test interactions:**
   - Click on vehicle markers to see popup with details
   - Watch for automatic updates every 30 seconds
   - Open browser console to see WebSocket logs:
     ```
     🚗 Connected to vehicle tracking
     📍 Received 5 vehicle locations
     ```

4. **Test reconnection:**
   - Stop backend server: `Ctrl+C` in backend terminal
   - Frontend should show "Disconnected" status
   - Restart backend: `npm run dev`
   - Frontend should auto-reconnect and show "Connected"

### Method 2: Standalone HTML Test Page

1. **Open the test page:**
   ```
   file:///C:/Users/lmets/OneDrive/Desktop/my-awesome-project/test-tracking-websocket.html
   ```
   Or use a local server:
   ```bash
   npx http-server . -p 8080
   # Then open: http://localhost:8080/test-tracking-websocket.html
   ```

2. **Click "Connect"**
   - Status should change to "Connected to WebSocket"
   - Log shows: `✅ Connected successfully! Socket ID: ...`

3. **Click "Subscribe to Locations"**
   - Log shows: `✅ Subscribed to: locations`
   - Should immediately receive vehicle data

4. **Vehicle cards appear:**
   - Shows vehicle details (make, model, license, status)
   - GPS coordinates displayed
   - Speed and heading shown
   - Auto-updates every 30 seconds

5. **Click "Get Statistics"**
   - Emits `get:statistics` event
   - Backend responds with telemetry stats

### Method 3: Browser Console Testing

1. **Open browser console** (F12)

2. **Load Socket.IO client:**
   ```javascript
   // If on tracking page, socket is already loaded
   // Otherwise, load from CDN:
   const script = document.createElement('script');
   script.src = 'https://cdn.socket.io/4.6.1/socket.io.min.js';
   document.head.appendChild(script);
   ```

3. **Connect to tracking namespace:**
   ```javascript
   const socket = io('http://localhost:3000/tracking', {
     autoConnect: true,
     reconnection: true
   });

   socket.on('connect', () => {
     console.log('✅ Connected! ID:', socket.id);
   });

   socket.on('vehicle:locations', (data) => {
     console.log(`📍 Received ${data.count} vehicles:`, data.vehicles);
   });

   socket.on('disconnect', (reason) => {
     console.log('❌ Disconnected:', reason);
   });

   // Subscribe to updates
   socket.emit('subscribe:locations');
   ```

4. **Request vehicle history:**
   ```javascript
   socket.emit('get:vehicle-history', {
     vehicleId: 'some-uuid-here',
     hours: 24
   });

   socket.on('vehicle:history', (data) => {
     console.log(`📜 History for ${data.vehicleId}:`, data.history);
   });
   ```

5. **Get telemetry statistics:**
   ```javascript
   socket.emit('get:statistics');

   socket.on('statistics', (data) => {
     console.log('📊 Statistics:', data);
   });
   ```

### Method 4: cURL + WebSocket Tools

1. **Test REST endpoints (if exposed):**
   ```bash
   # Get tracking statistics via HTTP
   curl http://localhost:3000/api/tracking/statistics

   # Response:
   # {
   #   "totalRecords": 120,
   #   "vehiclesTracked": 10,
   #   "oldestRecord": "2024-01-15T10:00:00Z",
   #   "newestRecord": "2024-01-15T10:30:00Z"
   # }
   ```

2. **Use wscat for WebSocket testing:**
   ```bash
   # Install wscat
   npm install -g wscat

   # Connect to tracking namespace
   wscat -c ws://localhost:3000/tracking

   # Connected!
   # You'll receive vehicle:locations events every 30 seconds

   # Send subscription
   > {"event": "subscribe:locations"}

   # Request statistics
   > {"event": "get:statistics"}
   ```

## Verification Checklist

### Backend Checks

- [ ] TrackingModule loaded in app.module.ts
- [ ] TrackingGateway WebSocket server starts on `/tracking` namespace
- [ ] `@Interval(30000)` broadcasts every 30 seconds
- [ ] SQL query returns latest vehicle locations
- [ ] PostGIS `ST_X()` and `ST_Y()` extract coordinates correctly
- [ ] Connected clients tracked in Set
- [ ] Events emitted: `vehicle:locations`, `vehicle:history`, `subscribed`
- [ ] Events received: `subscribe:locations`, `get:vehicle-history`, `get:statistics`

### Frontend Checks

- [ ] socket.io-client installed in package.json
- [ ] getTrackingSocket() creates connection to `/tracking` namespace
- [ ] VehicleMap component mounts and connects
- [ ] Leaflet CSS loaded (`import 'leaflet/dist/leaflet.css'`)
- [ ] Custom vehicle icons display with correct colors
- [ ] Map markers render at correct lat/lon
- [ ] Popup shows vehicle details on click
- [ ] Status panel shows connection state
- [ ] Auto-reconnect works after disconnect
- [ ] Memory cleanup on component unmount

### Database Checks

```sql
-- Check telemetry table exists
SELECT COUNT(*) FROM telemetry;

-- Check recent telemetry data
SELECT
    v.license_plate,
    t.speed,
    t.heading,
    ST_AsText(t.location::geometry) as location_wkt,
    t.timestamp
FROM telemetry t
JOIN vehicles v ON v.id = t.vehicle_id
WHERE t.timestamp > NOW() - INTERVAL '1 hour'
ORDER BY t.timestamp DESC
LIMIT 10;

-- Check latest location per vehicle
SELECT DISTINCT ON (vehicle_id)
    vehicle_id,
    ST_Y(location::geometry) as latitude,
    ST_X(location::geometry) as longitude,
    speed,
    heading,
    timestamp
FROM telemetry
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY vehicle_id, timestamp DESC;
```

## Troubleshooting

### Issue: No vehicles showing on map

**Cause:** No telemetry data in database

**Solution:**
```sql
-- Check if telemetry exists
SELECT COUNT(*) FROM telemetry WHERE timestamp > NOW() - INTERVAL '1 hour';

-- If 0, run seed script
\i backend/scripts/seed-telemetry.sql
```

### Issue: WebSocket connection fails

**Cause:** CORS or backend not running

**Solution:**
1. Check backend is running: `curl http://localhost:3000/health`
2. Check WebSocket gateway logs in backend console
3. Verify CORS settings in `@WebSocketGateway` decorator
4. Check browser console for error details

### Issue: Map not displaying

**Cause:** Leaflet CSS not loaded or container height issue

**Solution:**
1. Verify `import 'leaflet/dist/leaflet.css'` in VehicleMap.tsx
2. Check parent container has explicit height (not `height: auto`)
3. Open browser DevTools and check for CSS errors

### Issue: Icons not showing

**Cause:** Vite asset loading issue

**Solution:**
```typescript
// VehicleMap.tsx already includes this fix:
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});
L.Marker.prototype.options.icon = DefaultIcon;
```

### Issue: Updates not happening every 30 seconds

**Cause:** `@Interval` decorator not working or ScheduleModule not imported

**Solution:**
1. Check TrackingModule imports `ScheduleModule.forRoot()`
2. Verify `@nestjs/schedule` is installed
3. Check backend logs for "Broadcasting vehicle locations" message
4. Ensure at least one client is connected (gateway only broadcasts if clients exist)

### Issue: Coordinates showing as 0,0 or NULL

**Cause:** PostGIS function error or invalid data

**Solution:**
```sql
-- Check if location is valid PostGIS geography
SELECT
    id,
    ST_AsText(location::geometry) as location_text,
    ST_X(location::geometry) as lon,
    ST_Y(location::geometry) as lat
FROM telemetry
LIMIT 5;

-- If NULL, data is invalid. Re-insert:
DELETE FROM telemetry;
-- Run seed script again
```

## Performance Testing

### Load Test: Multiple Clients

1. **Open multiple browser tabs:**
   - Tab 1: `http://localhost:5173/tracking`
   - Tab 2: `http://localhost:5173/tracking`
   - Tab 3: `http://localhost:5173/tracking`

2. **Check backend logs:**
   ```
   [TrackingGateway] New client connected: socket-id-1
   [TrackingGateway] New client connected: socket-id-2
   [TrackingGateway] New client connected: socket-id-3
   [TrackingGateway] Broadcasting vehicle locations to 3 clients
   ```

3. **Verify all tabs receive updates simultaneously**

### Load Test: Large Dataset

```sql
-- Insert 1000 telemetry records
INSERT INTO telemetry (vehicle_id, location, speed, heading, timestamp)
SELECT
    v.id,
    ST_GeogFromText('POINT(' || (-122.5 + random() * 0.2)::text || ' ' || (37.7 + random() * 0.2)::text || ')'),
    (20 + random() * 80)::decimal(5,2),
    (random() * 360)::decimal(5,2),
    NOW() - (random() * interval '1 hour')
FROM vehicles v
CROSS JOIN generate_series(1, 100);

-- Query should still be fast (< 100ms)
EXPLAIN ANALYZE
SELECT DISTINCT ON (vehicle_id)
    vehicle_id,
    ST_Y(location::geometry) as latitude,
    ST_X(location::geometry) as longitude,
    speed, heading, timestamp
FROM telemetry
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY vehicle_id, timestamp DESC;
```

## Expected Results

### Successful Connection

**Backend Logs:**
```
[Nest] INFO [TrackingGateway] WebSocket server initialized on /tracking namespace
[TrackingGateway] New client connected: aB3dF...
[TrackingGateway] Sending initial locations to client: aB3dF...
[TrackingGateway] Broadcasting vehicle locations to 1 clients
[TrackingGateway] ✅ Broadcast 5 vehicle locations
```

**Frontend Console:**
```
✅ Connected to tracking socket
📍 Received 5 vehicle locations
[
  {
    vehicleId: "uuid-1",
    latitude: 37.7749,
    longitude: -122.4194,
    speed: 45.5,
    heading: 180,
    vehicleInfo: { ... }
  },
  ...
]
```

**Browser UI:**
- Status panel: "Connected" with green dot
- Map shows 5 markers
- Vehicle count: "5"
- Last update: "10:30:15 AM"
- Markers are color-coded correctly

### WebSocket Event Flow

```
1. Client connects → Server sends immediate vehicle:locations
2. Client emits subscribe:locations → Server responds { event: 'subscribed', room: 'locations' }
3. Every 30 seconds → Server broadcasts vehicle:locations to all clients
4. Client emits get:vehicle-history → Server responds with vehicle:history
5. Client disconnects → Server logs disconnection
```

## Next Steps

After confirming everything works:

1. **Add authentication** to WebSocket handshake
2. **Implement geofencing** alerts
3. **Add vehicle trail history** visualization
4. **Create heatmap layer** for traffic patterns
5. **Build mobile app** with native maps
6. **Add push notifications** for critical events
7. **Implement route replay** feature

## Success Criteria

- ✅ WebSocket connects on page load
- ✅ Initial vehicle data loads within 1 second
- ✅ Map displays all vehicles correctly
- ✅ Updates broadcast every 30 seconds
- ✅ Auto-reconnect works after disconnect
- ✅ No memory leaks (check Chrome DevTools Memory profiler)
- ✅ Handles 10+ concurrent clients smoothly
- ✅ SQL query executes in < 100ms
- ✅ Frontend renders 50+ vehicles without lag
