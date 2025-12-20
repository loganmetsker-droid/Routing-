-- =====================================================
-- V1: Core Tables Migration
-- Routing & Dispatching SaaS Platform
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- =====================================================
-- VEHICLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Vehicle identification
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vin VARCHAR(17) UNIQUE,

    -- Vehicle specifications
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'van',
    capacity_weight_kg DECIMAL(10, 2),
    capacity_volume_m3 DECIMAL(10, 2),
    fuel_type VARCHAR(20) DEFAULT 'diesel',

    -- Status and tracking
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    current_location GEOGRAPHY(POINT, 4326),
    current_odometer_km DECIMAL(10, 2) DEFAULT 0,
    last_maintenance_date DATE,
    next_maintenance_km DECIMAL(10, 2),

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_vehicle_status CHECK (
        status IN ('available', 'in_use', 'maintenance', 'out_of_service', 'retired')
    ),
    CONSTRAINT valid_vehicle_type CHECK (
        vehicle_type IN ('van', 'truck', 'motorcycle', 'car', 'semi_truck')
    ),
    CONSTRAINT valid_fuel_type CHECK (
        fuel_type IN ('diesel', 'gasoline', 'electric', 'hybrid', 'cng', 'lpg')
    )
);

-- Indexes for vehicles
CREATE INDEX idx_vehicles_status ON vehicles(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_type ON vehicles(vehicle_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_location ON vehicles USING GIST(current_location) WHERE current_location IS NOT NULL;
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate) WHERE deleted_at IS NULL;

-- =====================================================
-- DRIVERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Personal information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE,

    -- Driver credentials
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_class VARCHAR(10),
    license_expiry_date DATE NOT NULL,
    certifications JSONB DEFAULT '[]'::jsonb,

    -- Employment information
    employee_id VARCHAR(50) UNIQUE,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    employment_status VARCHAR(20) NOT NULL DEFAULT 'active',

    -- Current status and location
    status VARCHAR(20) NOT NULL DEFAULT 'off_duty',
    current_location GEOGRAPHY(POINT, 4326),
    current_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,

    -- Performance metrics
    total_hours_driven DECIMAL(10, 2) DEFAULT 0,
    total_distance_km DECIMAL(10, 2) DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2),

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_driver_status CHECK (
        status IN ('available', 'on_route', 'on_break', 'off_duty', 'unavailable')
    ),
    CONSTRAINT valid_employment_status CHECK (
        employment_status IN ('active', 'on_leave', 'suspended', 'terminated')
    ),
    CONSTRAINT valid_rating CHECK (
        average_rating IS NULL OR (average_rating >= 0 AND average_rating <= 5)
    ),
    CONSTRAINT valid_license_expiry CHECK (license_expiry_date > CURRENT_DATE)
);

-- Indexes for drivers
CREATE INDEX idx_drivers_status ON drivers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_drivers_employment ON drivers(employment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_drivers_email ON drivers(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location) WHERE current_location IS NOT NULL;
CREATE INDEX idx_drivers_current_vehicle ON drivers(current_vehicle_id) WHERE current_vehicle_id IS NOT NULL;

-- =====================================================
-- SHIFTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Shift associations
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,

    -- Shift timing
    shift_date DATE NOT NULL,
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,

    -- Shift details
    shift_type VARCHAR(20) NOT NULL DEFAULT 'regular',
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',

    -- Location tracking
    start_location GEOGRAPHY(POINT, 4326),
    end_location GEOGRAPHY(POINT, 4326),

    -- Break tracking
    total_break_minutes INTEGER DEFAULT 0,
    breaks JSONB DEFAULT '[]'::jsonb,

    -- Performance metrics
    distance_covered_km DECIMAL(10, 2),
    deliveries_completed INTEGER DEFAULT 0,
    fuel_consumed_liters DECIMAL(10, 2),

    -- Notes and metadata
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_shift_type CHECK (
        shift_type IN ('regular', 'overtime', 'split', 'on_call', 'emergency')
    ),
    CONSTRAINT valid_shift_status CHECK (
        status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')
    ),
    CONSTRAINT valid_shift_times CHECK (
        scheduled_end > scheduled_start
        AND (actual_end IS NULL OR actual_end > actual_start)
    )
);

-- Indexes for shifts
CREATE INDEX idx_shifts_driver ON shifts(driver_id);
CREATE INDEX idx_shifts_vehicle ON shifts(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_shifts_date ON shifts(shift_date);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_scheduled_start ON shifts(scheduled_start);

-- =====================================================
-- JOBS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Job identification
    job_number VARCHAR(50) UNIQUE NOT NULL,
    job_type VARCHAR(50) NOT NULL DEFAULT 'delivery',

    -- Job assignment
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,

    -- Customer information
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),

    -- Location information
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_city VARCHAR(100),
    pickup_postal_code VARCHAR(20),

    delivery_location GEOGRAPHY(POINT, 4326) NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_city VARCHAR(100),
    delivery_postal_code VARCHAR(20),

    -- Timing
    scheduled_pickup_time TIMESTAMP WITH TIME ZONE,
    scheduled_delivery_time TIMESTAMP WITH TIME ZONE,
    actual_pickup_time TIMESTAMP WITH TIME ZONE,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,

    -- Job details
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Package/load information
    package_count INTEGER DEFAULT 1,
    weight_kg DECIMAL(10, 2),
    volume_m3 DECIMAL(10, 2),
    special_instructions TEXT,

    -- Pricing
    estimated_cost DECIMAL(10, 2),
    actual_cost DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Proof of delivery
    signature_image_url TEXT,
    delivery_photo_url TEXT,
    delivery_notes TEXT,

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_job_type CHECK (
        job_type IN ('delivery', 'pickup', 'service_call', 'transport', 'return')
    ),
    CONSTRAINT valid_job_priority CHECK (
        priority IN ('low', 'normal', 'high', 'urgent', 'emergency')
    ),
    CONSTRAINT valid_job_status CHECK (
        status IN ('pending', 'assigned', 'in_transit', 'at_pickup', 'picked_up',
                   'at_delivery', 'delivered', 'failed', 'cancelled', 'returned')
    )
);

-- Indexes for jobs
CREATE INDEX idx_jobs_status ON jobs(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_priority ON jobs(priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_driver ON jobs(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX idx_jobs_vehicle ON jobs(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_jobs_shift ON jobs(shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_jobs_pickup_location ON jobs USING GIST(pickup_location);
CREATE INDEX idx_jobs_delivery_location ON jobs USING GIST(delivery_location);
CREATE INDEX idx_jobs_scheduled_pickup ON jobs(scheduled_pickup_time);
CREATE INDEX idx_jobs_scheduled_delivery ON jobs(scheduled_delivery_time);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
CREATE INDEX idx_jobs_job_number ON jobs(job_number) WHERE deleted_at IS NULL;

-- =====================================================
-- ROUTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Route identification
    route_name VARCHAR(255),
    route_number VARCHAR(50) UNIQUE,

    -- Route assignment
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,

    -- Route planning
    status VARCHAR(20) NOT NULL DEFAULT 'planned',
    route_type VARCHAR(20) DEFAULT 'delivery',

    -- Geographic information
    start_location GEOGRAPHY(POINT, 4326) NOT NULL,
    end_location GEOGRAPHY(POINT, 4326) NOT NULL,
    waypoints JSONB DEFAULT '[]'::jsonb,
    route_geometry GEOGRAPHY(LINESTRING, 4326),

    -- Distance and time estimates
    estimated_distance_km DECIMAL(10, 2),
    estimated_duration_minutes INTEGER,
    actual_distance_km DECIMAL(10, 2),
    actual_duration_minutes INTEGER,

    -- Timing
    planned_start_time TIMESTAMP WITH TIME ZONE,
    planned_end_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,

    -- Route optimization
    optimization_score DECIMAL(5, 2),
    optimization_algorithm VARCHAR(50),
    traffic_factor DECIMAL(3, 2) DEFAULT 1.0,

    -- Performance metrics
    stops_count INTEGER DEFAULT 0,
    completed_stops INTEGER DEFAULT 0,
    fuel_efficiency_km_per_liter DECIMAL(5, 2),

    -- Notes and metadata
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_route_status CHECK (
        status IN ('planned', 'assigned', 'in_progress', 'paused', 'completed', 'cancelled', 'failed')
    ),
    CONSTRAINT valid_route_type CHECK (
        route_type IN ('delivery', 'pickup', 'service', 'mixed', 'return')
    ),
    CONSTRAINT valid_timing CHECK (
        planned_end_time IS NULL OR planned_end_time > planned_start_time
    )
);

-- Indexes for routes
CREATE INDEX idx_routes_status ON routes(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_routes_driver ON routes(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX idx_routes_vehicle ON routes(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_routes_shift ON routes(shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_routes_start_location ON routes USING GIST(start_location);
CREATE INDEX idx_routes_end_location ON routes USING GIST(end_location);
CREATE INDEX idx_routes_geometry ON routes USING GIST(route_geometry) WHERE route_geometry IS NOT NULL;
CREATE INDEX idx_routes_planned_start ON routes(planned_start_time);
CREATE INDEX idx_routes_created_at ON routes(created_at);

-- =====================================================
-- ROUTE_JOBS (Junction Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS route_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    -- Sequencing
    sequence_number INTEGER NOT NULL,

    -- Timing estimates
    estimated_arrival_time TIMESTAMP WITH TIME ZONE,
    actual_arrival_time TIMESTAMP WITH TIME ZONE,
    estimated_service_duration_minutes INTEGER DEFAULT 15,
    actual_service_duration_minutes INTEGER,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Distance from previous stop
    distance_from_previous_km DECIMAL(10, 2),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_route_job UNIQUE(route_id, job_id),
    CONSTRAINT unique_route_sequence UNIQUE(route_id, sequence_number),
    CONSTRAINT valid_route_job_status CHECK (
        status IN ('pending', 'in_transit', 'arrived', 'completed', 'skipped', 'failed')
    )
);

-- Indexes for route_jobs
CREATE INDEX idx_route_jobs_route ON route_jobs(route_id);
CREATE INDEX idx_route_jobs_job ON route_jobs(job_id);
CREATE INDEX idx_route_jobs_sequence ON route_jobs(route_id, sequence_number);

-- =====================================================
-- TELEMETRY TABLE (will be converted to hypertable)
-- =====================================================
CREATE TABLE IF NOT EXISTS telemetry (
    time TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Entity tracking
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,

    -- Location data
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    altitude_meters DECIMAL(8, 2),
    accuracy_meters DECIMAL(8, 2),

    -- Motion data
    speed_kmh DECIMAL(6, 2),
    heading_degrees DECIMAL(5, 2),
    acceleration_mps2 DECIMAL(6, 3),

    -- Vehicle telemetry
    odometer_km DECIMAL(10, 2),
    fuel_level_percent DECIMAL(5, 2),
    engine_temp_celsius DECIMAL(5, 2),
    battery_voltage DECIMAL(4, 2),

    -- Driver behavior
    harsh_braking BOOLEAN DEFAULT FALSE,
    harsh_acceleration BOOLEAN DEFAULT FALSE,
    harsh_cornering BOOLEAN DEFAULT FALSE,
    speeding BOOLEAN DEFAULT FALSE,
    speed_limit_kmh DECIMAL(5, 2),

    -- Environmental
    ambient_temp_celsius DECIMAL(5, 2),

    -- Event tracking
    event_type VARCHAR(50),
    event_data JSONB,

    -- Additional metadata
    metadata JSONB,

    -- Constraints
    CONSTRAINT valid_telemetry_speed CHECK (speed_kmh >= 0 AND speed_kmh <= 300),
    CONSTRAINT valid_telemetry_heading CHECK (heading_degrees IS NULL OR (heading_degrees >= 0 AND heading_degrees < 360)),
    CONSTRAINT valid_fuel_level CHECK (fuel_level_percent IS NULL OR (fuel_level_percent >= 0 AND fuel_level_percent <= 100))
);

-- Regular indexes (before converting to hypertable)
CREATE INDEX idx_telemetry_vehicle_time ON telemetry(vehicle_id, time DESC);
CREATE INDEX idx_telemetry_driver_time ON telemetry(driver_id, time DESC) WHERE driver_id IS NOT NULL;
CREATE INDEX idx_telemetry_route_time ON telemetry(route_id, time DESC) WHERE route_id IS NOT NULL;
CREATE INDEX idx_telemetry_location ON telemetry USING GIST(location);
CREATE INDEX idx_telemetry_event_type ON telemetry(event_type) WHERE event_type IS NOT NULL;

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_route_jobs_updated_at BEFORE UPDATE ON route_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE vehicles IS 'Fleet vehicles with capacity, status, and location tracking';
COMMENT ON TABLE drivers IS 'Driver information, credentials, and performance metrics';
COMMENT ON TABLE shifts IS 'Driver work shifts with timing and performance tracking';
COMMENT ON TABLE jobs IS 'Individual delivery/pickup jobs with locations and status';
COMMENT ON TABLE routes IS 'Optimized routes containing multiple jobs';
COMMENT ON TABLE route_jobs IS 'Junction table linking jobs to routes in sequence';
COMMENT ON TABLE telemetry IS 'Time-series telemetry data from vehicles and drivers (TimescaleDB hypertable)';

-- End of V1 migration
