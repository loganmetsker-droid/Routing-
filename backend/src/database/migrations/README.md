# Database Migrations

This directory contains SQL migration scripts for the Routing & Dispatching SaaS platform.

## Migration Files

### V1_create_tables.sql
Creates the core database schema including:
- **vehicles** - Fleet vehicle management with capacity, status, and location tracking
- **drivers** - Driver information, credentials, performance metrics
- **shifts** - Driver work shifts with timing and performance tracking
- **jobs** - Individual delivery/pickup jobs with locations and detailed status
- **routes** - Optimized routes containing multiple jobs with waypoints
- **route_jobs** - Junction table linking jobs to routes in sequence
- **telemetry** - Time-series telemetry data (prepared for hypertable conversion)

**Features:**
- PostGIS geography columns for geospatial data
- Comprehensive indexes on location and time columns
- Foreign key constraints with appropriate cascade rules
- Check constraints for data validation
- Automatic updated_at triggers
- Soft delete support (deleted_at columns)

### V2_create_hypertables.sql
Configures TimescaleDB features:
- Converts `telemetry` table to a hypertable (7-day chunks)
- Enables compression for data older than 7 days
- Sets up 90-day retention policy
- Creates continuous aggregates:
  - `telemetry_1min` - 1-minute summaries
  - `telemetry_1hour` - 1-hour summaries with safety scores
  - `telemetry_daily` - Daily summaries
- Helper functions for common queries:
  - `get_recent_vehicle_telemetry()` - Get recent GPS data
  - `calculate_driver_safety_score()` - Calculate driver safety metrics
  - `get_vehicle_route_geometry()` - Get vehicle path as geometry
  - `detect_vehicle_idle_periods()` - Find idle/stationary periods

### V3_seed_data.sql
Populates the database with sample data:
- **3 vehicles** - Various makes/models with different statuses
- **5 drivers** - Active drivers with different experience levels
- **1 active shift** - Current shift in progress
- **10 jobs** - Jobs with various statuses (pending, in_transit, delivered, failed)
- **2 routes** - One in progress, one planned
- **~11,000 telemetry records** - 3 hours of GPS tracking data at 30-second intervals

## Running Migrations

### Method 1: PostgreSQL Command Line

```bash
# Connect to your database
psql -U postgres -d routing_dispatch

# Run migrations in order
\i V1_create_tables.sql
\i V2_create_hypertables.sql
\i V3_seed_data.sql
```

### Method 2: Using psql from Command Line

```bash
psql -U postgres -d routing_dispatch -f V1_create_tables.sql
psql -U postgres -d routing_dispatch -f V2_create_hypertables.sql
psql -U postgres -d routing_dispatch -f V3_seed_data.sql
```

### Method 3: Docker Compose (Automatic on Startup)

Copy the migration files to the Docker initialization directory:

```bash
cp V1_create_tables.sql ../../../infrastructure/docker/init-db.d/
cp V2_create_hypertables.sql ../../../infrastructure/docker/init-db.d/
cp V3_seed_data.sql ../../../infrastructure/docker/init-db.d/
```

Then start the database:

```bash
docker-compose -f infrastructure/docker/docker-compose.dev.yml up
```

### Method 4: Using Node.js/TypeORM

```bash
cd backend
npm run migration:run
```

## Prerequisites

Ensure these PostgreSQL extensions are installed:
- `uuid-ossp` - UUID generation
- `postgis` - Geospatial data support
- `timescaledb` - Time-series data optimization

## Schema Overview

### Core Tables

```
vehicles (fleet management)
  ├── drivers (employee information)
  │   ├── shifts (work periods)
  │   │   └── jobs (delivery tasks)
  │   └── routes (optimized paths)
  │       └── route_jobs (job sequencing)
  └── telemetry (GPS tracking) [TimescaleDB hypertable]
```

### Relationships

- **vehicles** ↔ **drivers** (many-to-many via current_vehicle_id)
- **drivers** → **shifts** (one-to-many)
- **shifts** → **routes** (one-to-many)
- **routes** ↔ **jobs** (many-to-many via route_jobs)
- **vehicles** → **telemetry** (one-to-many)
- **drivers** → **telemetry** (one-to-many)

## Key Features

### Geospatial Capabilities
- All location columns use PostGIS `GEOGRAPHY(POINT, 4326)` type
- GIST indexes for efficient spatial queries
- Support for distance calculations, proximity searches
- Route geometry stored as `GEOGRAPHY(LINESTRING, 4326)`

### Time-Series Optimization
- TimescaleDB hypertable for telemetry data
- Automatic data compression after 7 days
- Automatic data retention (90 days)
- Continuous aggregates for fast analytics
- Pre-calculated safety scores and metrics

### Performance Optimization
- Strategic indexes on frequently queried columns
- Partial indexes for active records
- Composite indexes for common query patterns
- Automatic statistics updates

### Data Integrity
- Foreign key constraints with appropriate cascades
- Check constraints for enum-like values
- NOT NULL constraints on required fields
- Unique constraints on business keys

## Useful Queries

### Check Migration Status

```sql
-- Verify all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check hypertable status
SELECT * FROM timescaledb_information.hypertables;

-- Verify continuous aggregates
SELECT * FROM timescaledb_information.continuous_aggregates;

-- Check data counts
SELECT 'vehicles' as table_name, COUNT(*) FROM vehicles
UNION ALL SELECT 'drivers', COUNT(*) FROM drivers
UNION ALL SELECT 'shifts', COUNT(*) FROM shifts
UNION ALL SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL SELECT 'routes', COUNT(*) FROM routes
UNION ALL SELECT 'telemetry', COUNT(*) FROM telemetry;
```

### Test Geospatial Queries

```sql
-- Find vehicles within 5km of a point
SELECT
    license_plate,
    make,
    model,
    ST_Distance(current_location, ST_GeogFromText('POINT(-122.4194 37.7749)')) / 1000 as distance_km
FROM vehicles
WHERE current_location IS NOT NULL
  AND ST_DWithin(current_location, ST_GeogFromText('POINT(-122.4194 37.7749)'), 5000)
ORDER BY distance_km;
```

### Test Time-Series Queries

```sql
-- Recent telemetry for a vehicle
SELECT * FROM get_recent_vehicle_telemetry(
    '22222222-2222-2222-2222-222222222222'::uuid,
    60  -- last 60 minutes
);

-- Driver safety score
SELECT calculate_driver_safety_score(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    30  -- last 30 days
);

-- 1-hour telemetry summary
SELECT *
FROM telemetry_1hour
WHERE vehicle_id = '22222222-2222-2222-2222-222222222222'
ORDER BY bucket DESC
LIMIT 10;
```

## Rollback

To rollback migrations, drop tables in reverse dependency order:

```sql
DROP TABLE IF EXISTS route_jobs CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS telemetry CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;

-- Drop continuous aggregates
DROP MATERIALIZED VIEW IF EXISTS telemetry_daily;
DROP MATERIALIZED VIEW IF EXISTS telemetry_1hour;
DROP MATERIALIZED VIEW IF EXISTS telemetry_1min;

-- Drop functions
DROP FUNCTION IF EXISTS get_recent_vehicle_telemetry;
DROP FUNCTION IF EXISTS calculate_driver_safety_score;
DROP FUNCTION IF EXISTS get_vehicle_route_geometry;
DROP FUNCTION IF EXISTS detect_vehicle_idle_periods;
DROP FUNCTION IF EXISTS update_updated_at_column;
```

## Notes

- All timestamps use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
- UUIDs are used for primary keys to support distributed systems
- JSONB columns are used for flexible metadata storage
- Soft deletes are implemented via `deleted_at` columns
- Automatic `updated_at` triggers maintain data freshness

## Support

For issues or questions about migrations, refer to:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
