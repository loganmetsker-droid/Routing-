#!/bin/bash
# =====================================================
# Database Migration Runner
# Routing & Dispatching SaaS Platform
# =====================================================

set -e  # Exit on error

# Default database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-routing_dispatch}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Migration directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Migration Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Host: ${GREEN}${DB_HOST}:${DB_PORT}${NC}"
echo -e "Database: ${GREEN}${DB_NAME}${NC}"
echo -e "User: ${GREEN}${DB_USER}${NC}"
echo ""

# Function to run SQL file
run_migration() {
    local file=$1
    local description=$2

    echo -e "${YELLOW}Running: ${NC}${file}"
    echo -e "${BLUE}Description: ${NC}${description}"

    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -f "${SCRIPT_DIR}/${file}" \
        -v ON_ERROR_STOP=1

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${file} completed successfully${NC}"
        echo ""
    else
        echo -e "${RED}✗ ${file} failed${NC}"
        exit 1
    fi
}

# Check if database exists
echo -e "${YELLOW}Checking database connection...${NC}"
PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Cannot connect to database${NC}"
    echo -e "${YELLOW}Creating database...${NC}"

    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d postgres \
        -c "CREATE DATABASE ${DB_NAME};"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database created${NC}"
        echo ""
    else
        echo -e "${RED}✗ Failed to create database${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Database connection successful${NC}"
    echo ""
fi

# Run migrations in order
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Running Migrations${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

run_migration "V1_create_tables.sql" "Create core database schema"
run_migration "V2_create_hypertables.sql" "Setup TimescaleDB hypertables and aggregates"
run_migration "V3_seed_data.sql" "Insert sample seed data"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All migrations completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verify migration results
echo -e "${YELLOW}Verifying migration results...${NC}"
echo ""

PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -c "
SELECT 'vehicles' as table_name, COUNT(*) as count FROM vehicles
UNION ALL SELECT 'drivers', COUNT(*) FROM drivers
UNION ALL SELECT 'shifts', COUNT(*) FROM shifts
UNION ALL SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL SELECT 'routes', COUNT(*) FROM routes
UNION ALL SELECT 'route_jobs', COUNT(*) FROM route_jobs
UNION ALL SELECT 'telemetry', COUNT(*) FROM telemetry
ORDER BY table_name;
"

echo ""
echo -e "${GREEN}✓ Migration verification complete${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Review the data: psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME}"
echo -e "  2. Test your application"
echo -e "  3. Start developing!"
echo ""
