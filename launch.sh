#!/bin/bash
# Smart launch script that checks Docker first

echo "========================================"
echo " Routing & Dispatch - Smart Launcher"
echo "========================================"
echo ""

# Navigate to project directory
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project

echo "[1/4] Checking if Docker Desktop is running..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo ""
    echo "❌ Docker Desktop is NOT running!"
    echo ""
    echo "Please start Docker Desktop:"
    echo "  1. Press Windows key"
    echo "  2. Search for 'Docker Desktop'"
    echo "  3. Click to launch it"
    echo "  4. Wait for the whale icon to stop animating"
    echo ""
    echo "Then run this script again."
    echo ""
    exit 1
fi

echo "✓ Docker is running"
echo ""

echo "[2/4] Checking Docker Compose configuration..."
if ! docker compose config --quiet 2>&1 | grep -v "version.*obsolete"; then
    echo "❌ Docker Compose configuration is invalid!"
    exit 1
fi
echo "✓ Configuration valid"
echo ""

echo "[3/4] Starting services (this may take a few minutes)..."
docker compose up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to start services!"
    echo "Check the error message above."
    exit 1
fi
echo ""

echo "[4/4] Waiting for services to initialize..."
sleep 3
echo ""

echo "========================================"
echo " ✓ Services Started Successfully!"
echo "========================================"
echo ""
echo "Access the application:"
echo "  🌐 Frontend:    http://localhost:5173"
echo "  🔧 Backend API: http://localhost:3000/api"
echo "  📊 GraphQL:     http://localhost:3000/graphql"
echo "  💚 Health:      http://localhost:3000/health"
echo ""
echo "Useful commands:"
echo "  📋 View logs:        docker compose logs -f"
echo "  🛑 Stop services:    docker compose down"
echo "  🔄 Restart:          docker compose restart"
echo "  📊 Check status:     docker compose ps"
echo ""

# Ask if user wants to see logs
read -p "View logs now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Press Ctrl+C to exit logs..."
    sleep 2
    docker compose logs -f
fi
