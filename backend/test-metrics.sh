#!/bin/bash

# Test script for Prometheus metrics endpoint
# Run this after starting the NestJS server

echo "Testing Prometheus Metrics Endpoint..."
echo "========================================"
echo ""

# Check if server is running
echo "1. Checking if server is running on port 3000..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health/ping | grep -q "200"; then
  echo "✓ Server is running"
else
  echo "✗ Server is not running on port 3000"
  echo "  Please start the server with: npm run dev"
  exit 1
fi

echo ""
echo "2. Fetching metrics from /metrics endpoint..."
RESPONSE=$(curl -s http://localhost:3000/metrics)

if [ $? -eq 0 ]; then
  echo "✓ Metrics endpoint responded"
else
  echo "✗ Failed to fetch metrics"
  exit 1
fi

echo ""
echo "3. Checking for custom fleet metrics..."

# Check for each custom metric
metrics=(
  "fleet_avg_distance_per_vehicle_km"
  "fleet_fuel_consumption_liters_per_100km"
  "fleet_ontime_delivery_rate_percent"
  "fleet_active_vehicles_count"
  "fleet_total_vehicles_count"
)

for metric in "${metrics[@]}"; do
  if echo "$RESPONSE" | grep -q "$metric"; then
    echo "✓ Found metric: $metric"
  else
    echo "✗ Missing metric: $metric"
  fi
done

echo ""
echo "4. Checking for Node.js default metrics..."
default_metrics=(
  "process_cpu_user_seconds_total"
  "process_resident_memory_bytes"
  "nodejs_eventloop_lag_seconds"
)

for metric in "${default_metrics[@]}"; do
  if echo "$RESPONSE" | grep -q "$metric"; then
    echo "✓ Found default metric: $metric"
  else
    echo "✗ Missing default metric: $metric"
  fi
done

echo ""
echo "5. Sample metric output:"
echo "------------------------"
echo "$RESPONSE" | grep -A 2 "fleet_" | head -20

echo ""
echo "========================================"
echo "Metrics endpoint test complete!"
echo ""
echo "Full metrics available at: http://localhost:3000/metrics"
