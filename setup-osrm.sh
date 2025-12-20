#!/bin/bash
# OSRM Map Data Setup Script
# This script downloads and processes OpenStreetMap data for routing

set -e

echo "========================================"
echo "OSRM Map Data Setup"
echo "========================================"

# Configuration
REGION=${1:-"us-west"}  # Default to US West, can pass region as argument
MAP_DIR="./osrm-data"
TEMP_DIR="$MAP_DIR/temp"

# Available regions (feel free to change)
declare -A REGIONS
REGIONS["us-west"]="http://download.geofabrik.de/north-america/us/california-latest.osm.pbf"
REGIONS["us-east"]="http://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf"
REGIONS["europe"]="http://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf"
REGIONS["test"]="http://download.geofabrik.de/europe/monaco-latest.osm.pbf"  # Small for testing

# Get download URL
MAP_URL="${REGIONS[$REGION]}"
if [ -z "$MAP_URL" ]; then
    echo "Error: Unknown region '$REGION'"
    echo "Available regions: ${!REGIONS[@]}"
    exit 1
fi

MAP_FILE=$(basename "$MAP_URL")
MAP_NAME="${MAP_FILE%.osm.pbf}"

echo "Region: $REGION"
echo "Map URL: $MAP_URL"
echo "Output directory: $MAP_DIR"

# Create directories
mkdir -p "$MAP_DIR"
mkdir -p "$TEMP_DIR"

# Download map data if not exists
if [ ! -f "$TEMP_DIR/$MAP_FILE" ]; then
    echo ""
    echo "Downloading map data (~100-500MB depending on region)..."
    curl -L -o "$TEMP_DIR/$MAP_FILE" "$MAP_URL"
    echo "✓ Download complete"
else
    echo "✓ Map file already downloaded"
fi

# Process with OSRM
echo ""
echo "Processing map data with OSRM..."
echo "This may take 5-15 minutes depending on map size and your CPU..."

# Extract
if [ ! -f "$TEMP_DIR/$MAP_NAME.osrm" ]; then
    echo "1/3 Extracting road network..."
    docker run --rm \
        -v "$(pwd)/$TEMP_DIR:/data" \
        osrm/osrm-backend:latest \
        osrm-extract -p /opt/car.lua /data/$MAP_FILE
    echo "✓ Extract complete"
else
    echo "✓ Already extracted"
fi

# Partition
if [ ! -f "$TEMP_DIR/$MAP_NAME.osrm.partition" ]; then
    echo "2/3 Partitioning graph..."
    docker run --rm \
        -v "$(pwd)/$TEMP_DIR:/data" \
        osrm/osrm-backend:latest \
        osrm-partition /data/$MAP_NAME.osrm
    echo "✓ Partition complete"
else
    echo "✓ Already partitioned"
fi

# Customize
if [ ! -f "$TEMP_DIR/$MAP_NAME.osrm.cells" ]; then
    echo "3/3 Customizing weights..."
    docker run --rm \
        -v "$(pwd)/$TEMP_DIR:/data" \
        osrm/osrm-backend:latest \
        osrm-customize /data/$MAP_NAME.osrm
    echo "✓ Customize complete"
else
    echo "✓ Already customized"
fi

# Copy processed files to final location
echo ""
echo "Copying processed files..."
cp "$TEMP_DIR/$MAP_NAME.osrm"* "$MAP_DIR/"
echo "✓ Files ready in $MAP_DIR"

# Update docker-compose.yml volume path
echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "OSRM data is ready in: $MAP_DIR"
echo "Map region: $REGION ($MAP_NAME)"
echo ""
echo "Next steps:"
echo "1. Update docker-compose.yml routing-service volumes to:"
echo "   - ./osrm-data:/data"
echo ""
echo "2. Restart the routing service:"
echo "   docker compose restart routing-service"
echo ""
echo "3. Test routing at:"
echo "   http://localhost:5000/route/v1/driving/-122.4194,37.7749;-122.4089,37.7833"
echo ""
