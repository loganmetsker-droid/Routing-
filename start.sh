#!/bin/bash
# Routing & Dispatch - Quick Start Script
# This script launches the application using Docker Compose

set -e

echo "========================================"
echo " Routing & Dispatch SaaS Platform"
echo "========================================"
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

echo "Current directory: $(pwd)"
echo ""

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "[INFO] .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "[INFO] Please edit .env file with your configuration."
    echo ""
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "[ERROR] Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

echo "[1/3] Checking Docker Compose configuration..."
if ! docker compose config --quiet; then
    echo "[ERROR] Docker Compose configuration is invalid!"
    exit 1
fi
echo "[OK] Configuration valid"
echo ""

echo "[2/3] Starting all services..."
if ! docker compose up -d; then
    echo "[ERROR] Failed to start services!"
    exit 1
fi
echo ""

echo "[3/3] Waiting for services to be healthy..."
sleep 5
echo ""

echo "========================================"
echo " Services Started Successfully!"
echo "========================================"
echo ""
echo "Access the application:"
echo "  Frontend:    http://localhost:5173"
echo "  Backend API: http://localhost:3000/api"
echo "  GraphQL:     http://localhost:3000/graphql"
echo "  Health:      http://localhost:3000/health"
echo ""
echo "Useful commands:"
echo "  View logs:        docker compose logs -f"
echo "  Stop services:    docker compose down"
echo "  Restart services: docker compose restart"
echo ""

read -p "Do you want to view logs now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose logs -f
fi
