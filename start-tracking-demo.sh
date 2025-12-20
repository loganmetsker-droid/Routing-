#!/bin/bash

# Quick start script for Real-Time Vehicle Tracking Demo
# This script helps you start all required services in the correct order

set -e

echo ""
echo "========================================"
echo " Real-Time Vehicle Tracking Demo"
echo "========================================"
echo ""

# Check if Docker is running
echo "[1/5] Checking if Docker is running..."
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker first."
    exit 1
fi
echo "✅ Docker is running"

# Start PostgreSQL
echo ""
echo "[2/5] Starting PostgreSQL with PostGIS..."
cd infrastructure/docker
docker-compose -f docker-compose.dev.yml up -d postgres

echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Check for sample data
echo ""
echo "[3/5] Checking for sample data..."
echo "You can seed telemetry data with:"
echo "  docker exec -it routing-dispatch-postgres psql -U postgres -d routing_dispatch -f /app/backend/scripts/seed-telemetry.sql"
echo ""

cd ../..

# Start Backend in new terminal (macOS/Linux)
echo "[4/5] Starting Backend Server..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/backend\" && npm run dev"'
elif [[ -n "$DISPLAY" ]]; then
    # Linux with X
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd backend && npm run dev; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -hold -e "cd backend && npm run dev" &
    else
        echo "Starting backend in background..."
        cd backend && npm run dev > ../backend.log 2>&1 &
        cd ..
    fi
else
    # No GUI, start in background
    echo "Starting backend in background..."
    cd backend && npm run dev > ../backend.log 2>&1 &
    cd ..
fi

echo "Waiting for backend to start..."
sleep 10

# Start Frontend in new terminal
echo ""
echo "[5/5] Starting Frontend Server..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/frontend\" && npm run dev"'
elif [[ -n "$DISPLAY" ]]; then
    # Linux with X
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd frontend && npm run dev; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -hold -e "cd frontend && npm run dev" &
    else
        echo "Starting frontend in background..."
        cd frontend && npm run dev > ../frontend.log 2>&1 &
        cd ..
    fi
else
    # No GUI, start in background
    echo "Starting frontend in background..."
    cd frontend && npm run dev > ../frontend.log 2>&1 &
    cd ..
fi

echo ""
echo "========================================"
echo " Setup Complete!"
echo "========================================"
echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo "Tracking: http://localhost:5173/tracking"
echo ""
echo "WebSocket Test Page:"
echo "  file://$(pwd)/test-tracking-websocket.html"
echo ""
echo "Press Ctrl+C to stop this script"
echo ""

# Keep script running
wait
