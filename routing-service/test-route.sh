#!/bin/bash

# Test script for routing optimization service
# Make sure the service is running: docker-compose up routing-service

echo "=== Routing Service Test Script ==="
echo ""

# Base URL
BASE_URL="http://localhost:8000"

# 1. Health Check
echo "1. Testing health check..."
curl -s "$BASE_URL/health" | jq '.'
echo ""
echo ""

# 2. Optimize Route
echo "2. Testing route optimization..."
echo "Sending request with vehicle and 3 jobs..."
curl -X POST "$BASE_URL/route" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_ids": [
      "660e8400-e29b-41d4-a716-446655440001",
      "660e8400-e29b-41d4-a716-446655440002",
      "660e8400-e29b-41d4-a716-446655440003"
    ]
  }' | jq '.'
echo ""
echo ""

# 3. Get Vehicle Info
echo "3. Testing get vehicle..."
curl -s "$BASE_URL/vehicles/550e8400-e29b-41d4-a716-446655440000" | jq '.'
echo ""
echo ""

# 4. Get Job Info
echo "4. Testing get job..."
curl -s "$BASE_URL/jobs/660e8400-e29b-41d4-a716-446655440001" | jq '.'
echo ""
echo ""

echo "=== Tests Complete ==="
