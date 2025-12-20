# OSRM Routing Service Setup Guide

## Quick Fix - Stop the Errors

The routing service errors won't affect your main application. To stop them immediately:

```bash
# Stop the routing service only
docker compose stop routing-service
```

Your backend, frontend, and database will continue working normally.

---

## Full Setup - Enable Routing

To enable the routing service with map data:

### Option 1: Automated Setup (Recommended)

**Windows (Command Prompt):**
```cmd
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project
setup-maps.bat
```

**Git Bash/Linux:**
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
./setup-maps.sh
```

This will:
1. Download Monaco map data (~1MB)
2. Process it with OSRM (~2-5 minutes)
3. Set up the routing service automatically

### Option 2: Manual Setup

**Step 1: Create directory and download map**
```bash
mkdir osrm-data
cd osrm-data
curl -L -o monaco-latest.osm.pbf http://download.geofabrik.de/europe/monaco-latest.osm.pbf
```

**Step 2: Extract road network**
```bash
docker run --rm -v "$(pwd):/data" osrm/osrm-backend:latest \
  osrm-extract -p /opt/car.lua /data/monaco-latest.osm.pbf
```

**Step 3: Partition graph**
```bash
docker run --rm -v "$(pwd):/data" osrm/osrm-backend:latest \
  osrm-partition /data/monaco-latest.osrm
```

**Step 4: Customize weights**
```bash
docker run --rm -v "$(pwd):/data" osrm/osrm-backend:latest \
  osrm-customize /data/monaco-latest.osrm
```

**Step 5: Rename files**
```bash
# Rename all monaco-latest.osrm* files to map.osrm*
for file in monaco-latest.osrm*; do
    mv "$file" "${file/monaco-latest/map}"
done
cd ..
```

**Step 6: Restart routing service**
```bash
docker compose restart routing-service
```

---

## Using Different Regions

To use a different geographic region, modify the download URL:

### Available Regions:

**Small Test Regions (~1-10MB):**
- Monaco: `http://download.geofabrik.de/europe/monaco-latest.osm.pbf`
- Luxembourg: `http://download.geofabrik.de/europe/luxembourg-latest.osm.pbf`

**US States (~50-500MB):**
- California: `http://download.geofabrik.de/north-america/us/california-latest.osm.pbf`
- New York: `http://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf`
- Texas: `http://download.geofabrik.de/north-america/us/texas-latest.osm.pbf`

**European Countries (~100-1000MB):**
- Germany: `http://download.geofabrik.de/europe/germany-latest.osm.pbf`
- France: `http://download.geofabrik.de/europe/france-latest.osm.pbf`
- UK: `http://download.geofabrik.de/europe/great-britain-latest.osm.pbf`

Find more at: https://download.geofabrik.de/

**Note:** Larger regions take longer to process (15-60 minutes for states, 1-4 hours for countries).

---

## Testing the Routing Service

Once setup is complete, test the routing:

**Monaco Test Route:**
```bash
# Route from Monte Carlo Casino to Prince's Palace
curl "http://localhost:8080/route/v1/driving/7.4174,43.7311;7.4246,43.7373?overview=full"
```

**Expected Response:**
```json
{
  "code": "Ok",
  "routes": [{
    "distance": 1234.5,
    "duration": 123.4,
    "geometry": "..."
  }]
}
```

---

## Verifying Setup

**Check if files are ready:**
```bash
ls -la osrm-data/
```

You should see:
- `map.osrm`
- `map.osrm.cells`
- `map.osrm.datasource_names`
- `map.osrm.ebg`
- `map.osrm.edges`
- `map.osrm.fileIndex`
- `map.osrm.geometry`
- `map.osrm.icd`
- `map.osrm.maneuver_overrides`
- `map.osrm.names`
- `map.osrm.nbg_nodes`
- `map.osrm.partition`
- `map.osrm.properties`
- `map.osrm.ramIndex`
- `map.osrm.timestamp`
- `map.osrm.tld`
- `map.osrm.tls`
- `map.osrm.turn_duration_penalties`
- `map.osrm.turn_weight_penalties`

**Check service logs:**
```bash
docker compose logs routing-service
```

Should show: `[info] running and waiting for requests`

---

## Troubleshooting

**Error: Cannot find files**
- Make sure files are in `osrm-data/` directory
- Verify files are named `map.osrm*` (not `monaco-latest.osrm*`)
- Check docker-compose.yml volume path: `./osrm-data:/data`

**Error: Processing takes too long**
- Use a smaller region like Monaco for testing
- Increase Docker memory limit (Docker Desktop > Settings > Resources)

**Error: Docker commands fail**
- Make sure Docker Desktop is running
- Check Docker has internet access for pulling images

**Service keeps restarting**
- Check logs: `docker compose logs routing-service`
- Verify all .osrm files exist
- Try stopping and starting: `docker compose restart routing-service`

---

## Integration with Backend

Once OSRM is running, your NestJS backend can call it:

```typescript
// Example route optimization
const response = await axios.get(
  'http://routing-service:8080/route/v1/driving/' +
  '7.4174,43.7311;7.4246,43.7373'
);

const { distance, duration } = response.data.routes[0];
```

---

## Production Considerations

For production:
1. Use a region that covers your service area
2. Update maps monthly (OpenStreetMap data changes)
3. Use persistent volume for processed data
4. Consider using OSRM CDN or hosted service for large areas
5. Monitor memory usage (large maps use 1-8GB RAM)
