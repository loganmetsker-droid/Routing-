@echo off
REM Routing & Dispatch - Quick Start Script
REM This script launches the application using Docker Compose

echo ========================================
echo  Routing & Dispatch SaaS Platform
echo ========================================
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

echo Current directory: %CD%
echo.

REM Check if .env exists, if not copy from example
if not exist .env (
    echo [INFO] .env file not found. Creating from .env.example...
    copy .env.example .env
    echo [INFO] Please edit .env file with your configuration.
    echo.
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/3] Checking Docker Compose configuration...
docker compose config --quiet
if errorlevel 1 (
    echo [ERROR] Docker Compose configuration is invalid!
    pause
    exit /b 1
)
echo [OK] Configuration valid
echo.

echo [2/3] Starting all services...
docker compose up -d
if errorlevel 1 (
    echo [ERROR] Failed to start services!
    pause
    exit /b 1
)
echo.

echo [3/3] Waiting for services to be healthy...
timeout /t 5 /nobreak >nul
echo.

echo ========================================
echo  Services Started Successfully!
echo ========================================
echo.
echo Access the application:
echo   Frontend:    http://localhost:5173
echo   Backend API: http://localhost:3000/api
echo   GraphQL:     http://localhost:3000/graphql
echo   Health:      http://localhost:3000/health
echo.
echo Useful commands:
echo   View logs:        docker compose logs -f
echo   Stop services:    docker compose down
echo   Restart services: docker compose restart
echo.

choice /C YN /M "Do you want to view logs now"
if errorlevel 2 goto :end
if errorlevel 1 goto :logs

:logs
docker compose logs -f

:end
echo.
echo Press any key to exit...
pause >nul
