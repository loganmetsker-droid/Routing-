-- =====================================================
-- V2: TimescaleDB Hypertables Migration
-- Convert telemetry table to hypertable and add time-series optimizations
-- =====================================================

-- =====================================================
-- CONVERT TELEMETRY TO HYPERTABLE
-- =====================================================

-- Convert telemetry table to a TimescaleDB hypertable
-- Partitioned by time with 7-day chunks
SELECT create_hypertable(
    'telemetry',
    'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- =====================================================
-- COMPRESSION POLICY
-- =====================================================

-- Enable compression for telemetry data older than 7 days
-- This significantly reduces storage requirements
ALTER TABLE telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'vehicle_id, driver_id',
    timescaledb.compress_orderby = 'time DESC'
);

-- Add compression policy - compress chunks older than 7 days
SELECT add_compression_policy(
    'telemetry',
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- =====================================================
-- RETENTION POLICY
-- =====================================================

-- Automatically drop telemetry data older than 90 days
-- Adjust this based on your data retention requirements
SELECT add_retention_policy(
    'telemetry',
    INTERVAL '90 days',
    if_not_exists => TRUE
);

-- =====================================================
-- CONTINUOUS AGGREGATES
-- =====================================================

-- Continuous aggregate: 1-minute telemetry summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_1min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS bucket,
    vehicle_id,
    driver_id,
    route_id,

    -- Location tracking (use first location in the bucket)
    FIRST(location, time) AS location,

    -- Speed statistics
    AVG(speed_kmh) AS avg_speed_kmh,
    MAX(speed_kmh) AS max_speed_kmh,
    MIN(speed_kmh) AS min_speed_kmh,

    -- Distance calculation (approximate)
    SUM(speed_kmh) * (1.0 / 60.0) AS distance_km,

    -- Fuel consumption
    FIRST(fuel_level_percent, time) AS start_fuel_percent,
    LAST(fuel_level_percent, time) AS end_fuel_percent,

    -- Behavior metrics
    COUNT(*) FILTER (WHERE harsh_braking = TRUE) AS harsh_braking_count,
    COUNT(*) FILTER (WHERE harsh_acceleration = TRUE) AS harsh_acceleration_count,
    COUNT(*) FILTER (WHERE harsh_cornering = TRUE) AS harsh_cornering_count,
    COUNT(*) FILTER (WHERE speeding = TRUE) AS speeding_count,

    -- Data quality
    COUNT(*) AS data_points,
    AVG(accuracy_meters) AS avg_accuracy_meters

FROM telemetry
GROUP BY bucket, vehicle_id, driver_id, route_id;

-- Add refresh policy for 1-minute aggregates
SELECT add_continuous_aggregate_policy(
    'telemetry_1min',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);

-- Continuous aggregate: 1-hour telemetry summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_1hour
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    vehicle_id,
    driver_id,
    route_id,

    -- Speed statistics
    AVG(speed_kmh) AS avg_speed_kmh,
    MAX(speed_kmh) AS max_speed_kmh,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY speed_kmh) AS median_speed_kmh,

    -- Distance traveled (approximate)
    SUM(speed_kmh) AS total_distance_km,

    -- Fuel consumption
    FIRST(fuel_level_percent, time) AS start_fuel_percent,
    LAST(fuel_level_percent, time) AS end_fuel_percent,
    (FIRST(fuel_level_percent, time) - LAST(fuel_level_percent, time)) AS fuel_consumed_percent,

    -- Behavior metrics
    COUNT(*) FILTER (WHERE harsh_braking = TRUE) AS harsh_braking_count,
    COUNT(*) FILTER (WHERE harsh_acceleration = TRUE) AS harsh_acceleration_count,
    COUNT(*) FILTER (WHERE harsh_cornering = TRUE) AS harsh_cornering_count,
    COUNT(*) FILTER (WHERE speeding = TRUE) AS speeding_count,

    -- Safety score (0-100, higher is better)
    100 - (
        (COUNT(*) FILTER (WHERE harsh_braking = TRUE) * 5) +
        (COUNT(*) FILTER (WHERE harsh_acceleration = TRUE) * 5) +
        (COUNT(*) FILTER (WHERE harsh_cornering = TRUE) * 3) +
        (COUNT(*) FILTER (WHERE speeding = TRUE) * 10)
    ) AS safety_score,

    -- Odometer readings
    FIRST(odometer_km, time) AS start_odometer_km,
    LAST(odometer_km, time) AS end_odometer_km,

    -- Data quality
    COUNT(*) AS data_points,
    AVG(accuracy_meters) AS avg_accuracy_meters

FROM telemetry
GROUP BY bucket, vehicle_id, driver_id, route_id;

-- Add refresh policy for 1-hour aggregates
SELECT add_continuous_aggregate_policy(
    'telemetry_1hour',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Continuous aggregate: Daily telemetry summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    vehicle_id,
    driver_id,

    -- Distance traveled
    SUM(speed_kmh) AS total_distance_km,

    -- Time metrics
    COUNT(*) AS total_data_points,
    COUNT(*) * INTERVAL '1 second' AS total_time,

    -- Speed statistics
    AVG(speed_kmh) AS avg_speed_kmh,
    MAX(speed_kmh) AS max_speed_kmh,

    -- Fuel consumption
    FIRST(fuel_level_percent, time) AS start_fuel_percent,
    LAST(fuel_level_percent, time) AS end_fuel_percent,
    (FIRST(fuel_level_percent, time) - LAST(fuel_level_percent, time)) AS fuel_consumed_percent,

    -- Behavior metrics
    COUNT(*) FILTER (WHERE harsh_braking = TRUE) AS harsh_braking_count,
    COUNT(*) FILTER (WHERE harsh_acceleration = TRUE) AS harsh_acceleration_count,
    COUNT(*) FILTER (WHERE harsh_cornering = TRUE) AS harsh_cornering_count,
    COUNT(*) FILTER (WHERE speeding = TRUE) AS speeding_count,

    -- Daily safety score
    100 - LEAST(100, (
        (COUNT(*) FILTER (WHERE harsh_braking = TRUE) * 2) +
        (COUNT(*) FILTER (WHERE harsh_acceleration = TRUE) * 2) +
        (COUNT(*) FILTER (WHERE harsh_cornering = TRUE) * 1) +
        (COUNT(*) FILTER (WHERE speeding = TRUE) * 5)
    )) AS daily_safety_score,

    -- Unique routes
    COUNT(DISTINCT route_id) AS routes_count

FROM telemetry
GROUP BY bucket, vehicle_id, driver_id;

-- Add refresh policy for daily aggregates
SELECT add_continuous_aggregate_policy(
    'telemetry_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- =====================================================
-- INDEXES ON CONTINUOUS AGGREGATES
-- =====================================================

-- Indexes for 1-minute aggregates
CREATE INDEX idx_telemetry_1min_bucket ON telemetry_1min(bucket DESC);
CREATE INDEX idx_telemetry_1min_vehicle ON telemetry_1min(vehicle_id, bucket DESC);
CREATE INDEX idx_telemetry_1min_driver ON telemetry_1min(driver_id, bucket DESC) WHERE driver_id IS NOT NULL;

-- Indexes for 1-hour aggregates
CREATE INDEX idx_telemetry_1hour_bucket ON telemetry_1hour(bucket DESC);
CREATE INDEX idx_telemetry_1hour_vehicle ON telemetry_1hour(vehicle_id, bucket DESC);
CREATE INDEX idx_telemetry_1hour_driver ON telemetry_1hour(driver_id, bucket DESC) WHERE driver_id IS NOT NULL;

-- Indexes for daily aggregates
CREATE INDEX idx_telemetry_daily_bucket ON telemetry_daily(bucket DESC);
CREATE INDEX idx_telemetry_daily_vehicle ON telemetry_daily(vehicle_id, bucket DESC);
CREATE INDEX idx_telemetry_daily_driver ON telemetry_daily(driver_id, bucket DESC) WHERE driver_id IS NOT NULL;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get recent telemetry for a vehicle
CREATE OR REPLACE FUNCTION get_recent_vehicle_telemetry(
    p_vehicle_id UUID,
    p_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
    time TIMESTAMP WITH TIME ZONE,
    location GEOGRAPHY,
    speed_kmh DECIMAL,
    heading_degrees DECIMAL,
    fuel_level_percent DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.time,
        t.location,
        t.speed_kmh,
        t.heading_degrees,
        t.fuel_level_percent
    FROM telemetry t
    WHERE t.vehicle_id = p_vehicle_id
      AND t.time >= NOW() - (p_minutes || ' minutes')::INTERVAL
    ORDER BY t.time DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate driver safety score
CREATE OR REPLACE FUNCTION calculate_driver_safety_score(
    p_driver_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS DECIMAL AS $$
DECLARE
    v_score DECIMAL;
BEGIN
    SELECT
        100 - LEAST(100, (
            (COUNT(*) FILTER (WHERE harsh_braking = TRUE) * 0.5) +
            (COUNT(*) FILTER (WHERE harsh_acceleration = TRUE) * 0.5) +
            (COUNT(*) FILTER (WHERE harsh_cornering = TRUE) * 0.3) +
            (COUNT(*) FILTER (WHERE speeding = TRUE) * 2.0)
        ) / GREATEST(COUNT(*) / 1000.0, 1))
    INTO v_score
    FROM telemetry
    WHERE driver_id = p_driver_id
      AND time >= NOW() - (p_days || ' days')::INTERVAL;

    RETURN COALESCE(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to get vehicle location history as a line
CREATE OR REPLACE FUNCTION get_vehicle_route_geometry(
    p_vehicle_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE
)
RETURNS GEOGRAPHY AS $$
DECLARE
    v_geometry GEOGRAPHY;
BEGIN
    SELECT ST_MakeLine(location ORDER BY time)
    INTO v_geometry
    FROM telemetry
    WHERE vehicle_id = p_vehicle_id
      AND time BETWEEN p_start_time AND p_end_time
      AND location IS NOT NULL;

    RETURN v_geometry;
END;
$$ LANGUAGE plpgsql;

-- Function to detect idle time
CREATE OR REPLACE FUNCTION detect_vehicle_idle_periods(
    p_vehicle_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_speed_threshold DECIMAL DEFAULT 1.0,
    p_min_duration_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
    idle_start TIMESTAMP WITH TIME ZONE,
    idle_end TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    location GEOGRAPHY
) AS $$
BEGIN
    RETURN QUERY
    WITH idle_points AS (
        SELECT
            time,
            location,
            speed_kmh,
            LAG(time) OVER (ORDER BY time) AS prev_time,
            LEAD(time) OVER (ORDER BY time) AS next_time
        FROM telemetry
        WHERE vehicle_id = p_vehicle_id
          AND time BETWEEN p_start_time AND p_end_time
          AND speed_kmh <= p_speed_threshold
    ),
    idle_groups AS (
        SELECT
            time,
            location,
            time - LAG(time, 1, time) OVER (ORDER BY time) AS gap
        FROM idle_points
    ),
    idle_sessions AS (
        SELECT
            MIN(time) AS start_time,
            MAX(time) AS end_time,
            FIRST(location ORDER BY time) AS loc
        FROM (
            SELECT
                time,
                location,
                SUM(CASE WHEN gap > INTERVAL '5 minutes' THEN 1 ELSE 0 END)
                    OVER (ORDER BY time) AS session_id
            FROM idle_groups
        ) AS sessions
        GROUP BY session_id
    )
    SELECT
        start_time,
        end_time,
        EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER / 60,
        loc
    FROM idle_sessions
    WHERE EXTRACT(EPOCH FROM (end_time - start_time)) / 60 >= p_min_duration_minutes;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON MATERIALIZED VIEW telemetry_1min IS 'Continuous aggregate: 1-minute telemetry summaries';
COMMENT ON MATERIALIZED VIEW telemetry_1hour IS 'Continuous aggregate: 1-hour telemetry summaries with safety scores';
COMMENT ON MATERIALIZED VIEW telemetry_daily IS 'Continuous aggregate: Daily telemetry summaries';

COMMENT ON FUNCTION get_recent_vehicle_telemetry IS 'Get recent telemetry data for a specific vehicle';
COMMENT ON FUNCTION calculate_driver_safety_score IS 'Calculate driver safety score based on behavior metrics';
COMMENT ON FUNCTION get_vehicle_route_geometry IS 'Get vehicle path as a geography line for a time period';
COMMENT ON FUNCTION detect_vehicle_idle_periods IS 'Detect periods when vehicle was idle/stationary';

-- =====================================================
-- STATISTICS
-- =====================================================

-- Update statistics for better query planning
ANALYZE telemetry;

-- End of V2 migration
