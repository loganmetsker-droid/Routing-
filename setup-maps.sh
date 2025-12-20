#!/bin/bash
# OSRM Map Data Setup Script
# Downloads and processes Monaco test map for routing

set -e

echo "========================================"
echo "OSRM Map Data Setup"
echo "========================================"
echo ""
echo "This will download and process map data for routing."
echo "Region: Monaco (small test map - ~1MB download)"
echo "Processing time: ~2-5 minutes"
echo ""
read -p "Press Enter to continue, or Ctrl+C to cancel..."

# Create directory
mkdir -p osrm-data
cd osrm-data

# Download
echo ""
echo "[1/4] Downloading Monaco map data..."
if [ ! -f "monaco-latest.osm.pbf" ]; then
    curl -L -o monaco-latest.osm.pbf http://download.geofabrik.de/europe/monaco-latest.osm.pbf
    echo "✓ Download complete"
else
    echo "✓ Map already downloaded"
fi

# Extract
echo ""
echo "[2/4] Extracting road network..."
if [ ! -f "monaco-latest.osrm" ]; then
    docker run --rm -v "$(pwd):/data" osrm/osrm-backend:latest \
        osrm-extract -p /opt/car.lua /data/monaco-latest.osm.pbf
    echo "✓ Extract complete"
else
    echo "✓ Already extracted"
fi

# Partition
echo ""
echo "[3/4] Partitioning graph..."
if [ ! -f "monaco-latest.osrm.partition" ]; then
    docker run --rm -v "$(pwd):/data" osrm/osrm-backend:latest \
        osrm-partition /data/monaco-latest.osrm
    echo "✓ Partition complete"
else
    echo "✓ Already partitioned"
fi

# Customize
echo ""
echo "[4/4] Customizing weights..."
if [ ! -f "monaco-latest.osrm.cells" ]; then
    docker run --rm -v "$(pwd):/data" osrm/osrm-backend:latest \
        osrm-customize /data/monaco-latest.osrm
    echo "✓ Customize complete"
else
    echo "✓ Already customized"
fi

# Rename to map.osrm
echo ""
echo "Renaming files to map.osrm..."
for file in monaco-latest.osrm*; do
    newname="${file/monaco-latest/map}"
    mv -f "$file" "$newname"
done
echo "✓ Files renamed"

cd ..

echo ""
echo "========================================"
echo "SUCCESS! Map data is ready."
echo "========================================"
echo ""
echo "Directory: osrm-data/"
echo ""
echo "Next: Restart the routing service"
echo "  docker compose restart routing-service"
echo ""
echo "Test routing at:"
echo "  http://localhost:8080/route/v1/driving/7.4174,43.7311;7.4246,43.7373"
echo ""
