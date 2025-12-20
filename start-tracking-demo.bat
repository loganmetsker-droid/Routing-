@echo off
REM Quick start script for Real-Time Vehicle Tracking Demo
REM This script helps you start all required services in the correct order

echo.
echo ========================================
echo  Real-Time Vehicle Tracking Demo
echo ========================================
echo.

echo [1/5] Checking if Docker is running...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo OK: Docker is running

echo.
echo [2/5] Starting PostgreSQL with PostGIS...
cd infrastructure\docker
docker-compose -f docker-compose.dev.yml up -d postgres
if errorlevel 1 (
    echo ERROR: Failed to start PostgreSQL
    pause
    exit /b 1
)

echo Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

echo.
echo [3/5] Checking for sample data...
echo You can seed telemetry data with:
echo   docker exec -it routing-dispatch-postgres psql -U postgres -d routing_dispatch -f /app/backend/scripts/seed-telemetry.sql
echo.

cd ..\..

echo [4/5] Starting Backend Server...
echo Opening new window for backend...
start "Backend Server" cmd /k "cd backend && npm run dev"

echo Waiting for backend to start...
timeout /t 10 /nobreak >nul

echo.
echo [5/5] Starting Frontend Server...
echo Opening new window for frontend...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo Tracking: http://localhost:5173/tracking
echo.
echo WebSocket Test Page:
echo   file:///%CD%\test-tracking-websocket.html
echo.
echo Press Ctrl+C in each window to stop the servers
echo.
pause
