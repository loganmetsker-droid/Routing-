-- =====================================================
-- V3: Seed Data Migration
-- Sample data for development and testing
-- =====================================================

-- =====================================================
-- SEED VEHICLES (3 vehicles)
-- =====================================================

INSERT INTO vehicles (
    id,
    make,
    model,
    year,
    license_plate,
    vin,
    vehicle_type,
    capacity_weight_kg,
    capacity_volume_m3,
    fuel_type,
    status,
    current_location,
    current_odometer_km,
    last_maintenance_date,
    next_maintenance_km,
    metadata
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Ford',
    'Transit 350',
    2023,
    'ABC-1234',
    '1FTBW3XM5PKA12345',
    'van',
    1500.00,
    12.50,
    'diesel',
    'available',
    ST_GeogFromText('POINT(-122.4194 37.7749)'), -- San Francisco
    45230.50,
    '2024-11-15',
    50000.00,
    '{"color": "white", "features": ["gps", "rear_camera", "cargo_barrier"]}'::jsonb
),
(
    '22222222-2222-2222-2222-222222222222',
    'Mercedes-Benz',
    'Sprinter 2500',
    2024,
    'XYZ-5678',
    '2C4RDGBG5LR123456',
    'van',
    2000.00,
    15.80,
    'diesel',
    'in_use',
    ST_GeogFromText('POINT(-122.4083 37.7833)'), -- San Francisco (different location)
    12450.75,
    '2024-12-01',
    20000.00,
    '{"color": "silver", "features": ["gps", "refrigeration", "lift_gate"]}'::jsonb
),
(
    '33333333-3333-3333-3333-333333333333',
    'Chevrolet',
    'Express 3500',
    2022,
    'DEF-9012',
    '1GCWGAFG4K1234567',
    'van',
    1800.00,
    13.20,
    'gasoline',
    'available',
    ST_GeogFromText('POINT(-122.3959 37.7923)'), -- San Francisco (yet another location)
    68920.30,
    '2024-10-20',
    75000.00,
    '{"color": "blue", "features": ["gps", "cargo_shelving"]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED DRIVERS (5 drivers)
-- =====================================================

INSERT INTO drivers (
    id,
    first_name,
    last_name,
    email,
    phone,
    date_of_birth,
    license_number,
    license_class,
    license_expiry_date,
    certifications,
    employee_id,
    hire_date,
    employment_status,
    status,
    current_location,
    current_vehicle_id,
    total_hours_driven,
    total_distance_km,
    total_deliveries,
    average_rating,
    metadata
) VALUES
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'John',
    'Martinez',
    'john.martinez@example.com',
    '+1-415-555-0101',
    '1985-03-15',
    'DL-CA-1234567',
    'C',
    '2027-06-30',
    '["CDL", "Hazmat", "Forklift"]'::jsonb,
    'EMP-001',
    '2020-01-15',
    'active',
    'on_route',
    ST_GeogFromText('POINT(-122.4083 37.7833)'),
    '22222222-2222-2222-2222-222222222222',
    2450.50,
    125430.75,
    1823,
    4.85,
    '{"preferred_routes": ["north_bay", "east_bay"], "languages": ["en", "es"]}'::jsonb
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Sarah',
    'Chen',
    'sarah.chen@example.com',
    '+1-415-555-0102',
    '1990-07-22',
    'DL-CA-2345678',
    'C',
    '2026-12-15',
    '["CDL", "First Aid"]'::jsonb,
    'EMP-002',
    '2021-06-01',
    'active',
    'available',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    NULL,
    1820.25,
    98750.50,
    1456,
    4.92,
    '{"preferred_routes": ["downtown", "south_bay"], "languages": ["en", "zh"]}'::jsonb
),
(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Michael',
    'Thompson',
    'michael.thompson@example.com',
    '+1-415-555-0103',
    '1988-11-08',
    'DL-CA-3456789',
    'B',
    '2028-03-20',
    '["CDL"]'::jsonb,
    'EMP-003',
    '2019-03-10',
    'active',
    'available',
    ST_GeogFromText('POINT(-122.3959 37.7923)'),
    NULL,
    3125.75,
    156890.25,
    2341,
    4.78,
    '{"preferred_routes": ["peninsula", "south_bay"], "languages": ["en"]}'::jsonb
),
(
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Aisha',
    'Patel',
    'aisha.patel@example.com',
    '+1-415-555-0104',
    '1992-05-30',
    'DL-CA-4567890',
    'C',
    '2027-09-10',
    '["CDL", "Hazmat"]'::jsonb,
    'EMP-004',
    '2022-08-15',
    'active',
    'on_break',
    ST_GeogFromText('POINT(-122.4102 37.7858)'),
    NULL,
    945.50,
    52340.80,
    678,
    4.88,
    '{"preferred_routes": ["east_bay", "north_bay"], "languages": ["en", "hi"]}'::jsonb
),
(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'Carlos',
    'Rodriguez',
    'carlos.rodriguez@example.com',
    '+1-415-555-0105',
    '1983-09-12',
    'DL-CA-5678901',
    'C',
    '2026-11-25',
    '["CDL", "Forklift", "First Aid"]'::jsonb,
    'EMP-005',
    '2018-11-20',
    'active',
    'off_duty',
    NULL,
    NULL,
    3890.25,
    189650.40,
    2987,
    4.81,
    '{"preferred_routes": ["peninsula", "downtown"], "languages": ["en", "es"]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED SHIFTS (Current shift for active driver)
-- =====================================================

INSERT INTO shifts (
    id,
    driver_id,
    vehicle_id,
    shift_date,
    scheduled_start,
    scheduled_end,
    actual_start,
    shift_type,
    status,
    start_location,
    notes
) VALUES
(
    'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '8 hours',
    CURRENT_DATE + INTERVAL '16 hours',
    CURRENT_DATE + INTERVAL '8 hours 5 minutes',
    'regular',
    'in_progress',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    'Regular delivery route - North Bay area'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED JOBS (10 jobs with various statuses)
-- =====================================================

INSERT INTO jobs (
    id,
    job_number,
    job_type,
    driver_id,
    vehicle_id,
    shift_id,
    customer_name,
    customer_phone,
    customer_email,
    pickup_location,
    pickup_address,
    pickup_city,
    pickup_postal_code,
    delivery_location,
    delivery_address,
    delivery_city,
    delivery_postal_code,
    scheduled_pickup_time,
    scheduled_delivery_time,
    actual_pickup_time,
    actual_delivery_time,
    priority,
    status,
    package_count,
    weight_kg,
    volume_m3,
    special_instructions,
    estimated_cost,
    actual_cost,
    metadata
) VALUES
-- Job 1: Completed delivery
(
    '10000000-0000-0000-0000-000000000001',
    'JOB-2024-001',
    'delivery',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
    'TechCorp Inc',
    '+1-415-555-1001',
    'receiving@techcorp.com',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    '1234 Market Street, Suite 100',
    'San Francisco',
    '94102',
    ST_GeogFromText('POINT(-122.4683 37.8199)'),
    '5678 Industrial Way',
    'San Francisco',
    '94124',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours 55 minutes',
    CURRENT_TIMESTAMP - INTERVAL '1 hour 50 minutes',
    'normal',
    'delivered',
    5,
    125.50,
    2.30,
    'Fragile - Handle with care. Deliver to loading dock.',
    85.00,
    85.00,
    '{"signature_required": true, "delivery_confirmed": true}'::jsonb
),

-- Job 2: In transit
(
    '10000000-0000-0000-0000-000000000002',
    'JOB-2024-002',
    'delivery',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
    'MedSupply Partners',
    '+1-415-555-1002',
    'orders@medsupply.com',
    ST_GeogFromText('POINT(-122.4683 37.8199)'),
    '5678 Industrial Way',
    'San Francisco',
    '94124',
    ST_GeogFromText('POINT(-122.4567 37.8267)'),
    '910 Health Plaza Drive',
    'San Francisco',
    '94158',
    CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
    CURRENT_TIMESTAMP + INTERVAL '30 minutes',
    CURRENT_TIMESTAMP - INTERVAL '1 hour 25 minutes',
    NULL,
    'high',
    'in_transit',
    3,
    45.20,
    0.85,
    'Medical supplies - Temperature controlled. Priority delivery.',
    120.00,
    NULL,
    '{"temperature_range": "2-8C", "time_sensitive": true}'::jsonb
),

-- Job 3: Assigned but not started
(
    '10000000-0000-0000-0000-000000000003',
    'JOB-2024-003',
    'delivery',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    NULL,
    NULL,
    'Office Depot Solutions',
    '+1-415-555-1003',
    'warehouse@officedepot.com',
    ST_GeogFromText('POINT(-122.3985 37.7914)'),
    '234 Commerce Avenue',
    'San Francisco',
    '94110',
    ST_GeogFromText('POINT(-122.4102 37.7858)'),
    '1500 Mission Street, Floor 12',
    'San Francisco',
    '94103',
    CURRENT_TIMESTAMP + INTERVAL '2 hours',
    CURRENT_TIMESTAMP + INTERVAL '4 hours',
    NULL,
    NULL,
    'normal',
    'assigned',
    12,
    180.75,
    4.50,
    'Office furniture - Use freight elevator.',
    95.00,
    NULL,
    '{"requires_assembly": false, "elevator_access": true}'::jsonb
),

-- Job 4: Pending assignment
(
    '10000000-0000-0000-0000-000000000004',
    'JOB-2024-004',
    'pickup',
    NULL,
    NULL,
    NULL,
    'ReturnsPro',
    '+1-415-555-1004',
    'logistics@returnspro.com',
    ST_GeogFromText('POINT(-122.4250 37.7580)'),
    '789 Residential Lane, Apt 5B',
    'San Francisco',
    '94107',
    ST_GeogFromText('POINT(-122.3985 37.7914)'),
    '234 Commerce Avenue',
    'San Francisco',
    '94110',
    CURRENT_TIMESTAMP + INTERVAL '3 hours',
    CURRENT_TIMESTAMP + INTERVAL '5 hours',
    NULL,
    NULL,
    'low',
    'pending',
    2,
    22.30,
    0.45,
    'Customer return - Requires inspection before acceptance.',
    45.00,
    NULL,
    '{"return_authorization": "RA-2024-556", "inspection_required": true}'::jsonb
),

-- Job 5: Urgent delivery
(
    '10000000-0000-0000-0000-000000000005',
    'JOB-2024-005',
    'delivery',
    NULL,
    NULL,
    NULL,
    'FastParts Manufacturing',
    '+1-415-555-1005',
    'emergency@fastparts.com',
    ST_GeogFromText('POINT(-122.4074 37.7835)'),
    '567 Industrial Boulevard',
    'San Francisco',
    '94103',
    ST_GeogFromText('POINT(-122.3876 37.7295)'),
    '4321 Production Drive',
    'San Francisco',
    '94134',
    CURRENT_TIMESTAMP + INTERVAL '30 minutes',
    CURRENT_TIMESTAMP + INTERVAL '2 hours',
    NULL,
    NULL,
    'urgent',
    'pending',
    1,
    8.50,
    0.15,
    'URGENT: Replacement part for production line. Call upon arrival.',
    150.00,
    NULL,
    '{"contact_on_arrival": true, "production_critical": true}'::jsonb
),

-- Job 6: Scheduled for tomorrow
(
    '10000000-0000-0000-0000-000000000006',
    'JOB-2024-006',
    'delivery',
    NULL,
    NULL,
    NULL,
    'GourmetFoods Distribution',
    '+1-415-555-1006',
    'orders@gourmetfoods.com',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    '1000 Market Street',
    'San Francisco',
    '94102',
    ST_GeogFromText('POINT(-122.4456 37.7567)'),
    '2200 Restaurant Row',
    'San Francisco',
    '94107',
    CURRENT_TIMESTAMP + INTERVAL '1 day 8 hours',
    CURRENT_TIMESTAMP + INTERVAL '1 day 10 hours',
    NULL,
    NULL,
    'normal',
    'pending',
    8,
    215.60,
    3.20,
    'Perishable goods - Refrigerated transport required. Deliver before 11 AM.',
    110.00,
    NULL,
    '{"perishable": true, "refrigeration_required": true, "max_temp": "4C"}'::jsonb
),

-- Job 7: Failed delivery attempt
(
    '10000000-0000-0000-0000-000000000007',
    'JOB-2024-007',
    'delivery',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '33333333-3333-3333-3333-333333333333',
    NULL,
    'SmallBiz Supplies',
    '+1-415-555-1007',
    'info@smallbizsupplies.com',
    ST_GeogFromText('POINT(-122.4074 37.7835)'),
    '567 Industrial Boulevard',
    'San Francisco',
    '94103',
    ST_GeogFromText('POINT(-122.4315 37.7895)'),
    '3456 Small Business Park, Unit 7',
    'San Francisco',
    '94109',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '23 hours',
    CURRENT_TIMESTAMP - INTERVAL '23 hours 45 minutes',
    NULL,
    'normal',
    'failed',
    4,
    67.80,
    1.20,
    'Business closed - Rescheduling required.',
    70.00,
    NULL,
    '{"failure_reason": "recipient_unavailable", "retry_scheduled": true}'::jsonb
),

-- Job 8: Multi-package delivery
(
    '10000000-0000-0000-0000-000000000008',
    'JOB-2024-008',
    'delivery',
    NULL,
    NULL,
    NULL,
    'ElectroMart Wholesale',
    '+1-415-555-1008',
    'receiving@electromart.com',
    ST_GeogFromText('POINT(-122.3985 37.7914)'),
    '234 Commerce Avenue',
    'San Francisco',
    '94110',
    ST_GeogFromText('POINT(-122.4847 37.8199)'),
    '7890 Bayview Commerce Center',
    'San Francisco',
    '94124',
    CURRENT_TIMESTAMP + INTERVAL '4 hours',
    CURRENT_TIMESTAMP + INTERVAL '6 hours',
    NULL,
    NULL,
    'normal',
    'pending',
    25,
    450.00,
    8.75,
    'Large shipment - Requires dock access and forklift.',
    175.00,
    NULL,
    '{"dock_delivery": true, "forklift_required": true, "pallet_count": 3}'::jsonb
),

-- Job 9: Same-day express
(
    '10000000-0000-0000-0000-000000000009',
    'JOB-2024-009',
    'delivery',
    NULL,
    NULL,
    NULL,
    'LegalDocs Express',
    '+1-415-555-1009',
    'courier@legaldocs.com',
    ST_GeogFromText('POINT(-122.4074 37.7835)'),
    '567 Industrial Boulevard',
    'San Francisco',
    '94103',
    ST_GeogFromText('POINT(-122.4019 37.7881)'),
    '555 California Street, Floor 45',
    'San Francisco',
    '94104',
    CURRENT_TIMESTAMP + INTERVAL '1 hour',
    CURRENT_TIMESTAMP + INTERVAL '2 hours 30 minutes',
    NULL,
    NULL,
    'urgent',
    'pending',
    1,
    2.10,
    0.05,
    'Legal documents - Signature required. ID verification needed.',
    200.00,
    NULL,
    '{"signature_required": true, "id_verification": true, "confidential": true}'::jsonb
),

-- Job 10: Scheduled pickup and delivery
(
    '10000000-0000-0000-0000-000000000010',
    'JOB-2024-010',
    'transport',
    NULL,
    NULL,
    NULL,
    'Art Gallery Collective',
    '+1-415-555-1010',
    'curator@artgallery.com',
    ST_GeogFromText('POINT(-122.4315 37.7895)'),
    '100 Gallery Street',
    'San Francisco',
    '94109',
    ST_GeogFromText('POINT(-122.4683 37.8050)'),
    '250 Museum Boulevard',
    'San Francisco',
    '94123',
    CURRENT_TIMESTAMP + INTERVAL '2 days',
    CURRENT_TIMESTAMP + INTERVAL '2 days 3 hours',
    NULL,
    NULL,
    'high',
    'pending',
    6,
    320.50,
    5.60,
    'Fragile artwork - Climate controlled vehicle required. White glove service.',
    350.00,
    NULL,
    '{"white_glove": true, "climate_controlled": true, "insurance_value": 50000, "fragile": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED ROUTES (2 routes)
-- =====================================================

INSERT INTO routes (
    id,
    route_name,
    route_number,
    driver_id,
    vehicle_id,
    shift_id,
    status,
    route_type,
    start_location,
    end_location,
    waypoints,
    estimated_distance_km,
    estimated_duration_minutes,
    planned_start_time,
    planned_end_time,
    actual_start_time,
    stops_count,
    completed_stops,
    notes
) VALUES
(
    'r0000000-0000-0000-0000-000000000001',
    'North Bay Morning Route',
    'ROUTE-2024-001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
    'in_progress',
    'delivery',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    ST_GeogFromText('POINT(-122.4567 37.8267)'),
    '[
        {"lat": 37.7749, "lng": -122.4194, "stop_number": 1},
        {"lat": 37.8199, "lng": -122.4683, "stop_number": 2},
        {"lat": 37.8267, "lng": -122.4567, "stop_number": 3}
    ]'::jsonb,
    28.50,
    120,
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP + INTERVAL '1 hour',
    CURRENT_TIMESTAMP - INTERVAL '2 hours 55 minutes',
    2,
    1,
    'Optimized route for morning deliveries in North Bay area'
),
(
    'r0000000-0000-0000-0000-000000000002',
    'Downtown Afternoon Route',
    'ROUTE-2024-002',
    NULL,
    NULL,
    NULL,
    'planned',
    'mixed',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    ST_GeogFromText('POINT(-122.4019 37.7881)'),
    '[
        {"lat": 37.7749, "lng": -122.4194, "stop_number": 1},
        {"lat": 37.7835, "lng": -122.4074, "stop_number": 2},
        {"lat": 37.7881, "lng": -122.4019, "stop_number": 3}
    ]'::jsonb,
    12.30,
    75,
    CURRENT_TIMESTAMP + INTERVAL '3 hours',
    CURRENT_TIMESTAMP + INTERVAL '5 hours',
    NULL,
    3,
    0,
    'Planned route for afternoon downtown deliveries'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED ROUTE_JOBS (Link jobs to routes)
-- =====================================================

INSERT INTO route_jobs (
    route_id,
    job_id,
    sequence_number,
    estimated_arrival_time,
    actual_arrival_time,
    estimated_service_duration_minutes,
    actual_service_duration_minutes,
    status,
    distance_from_previous_km
) VALUES
-- Route 1, Job 1 (completed)
(
    'r0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    1,
    CURRENT_TIMESTAMP - INTERVAL '2 hours 30 minutes',
    CURRENT_TIMESTAMP - INTERVAL '1 hour 50 minutes',
    15,
    12,
    'completed',
    8.50
),
-- Route 1, Job 2 (in transit)
(
    'r0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    2,
    CURRENT_TIMESTAMP + INTERVAL '30 minutes',
    NULL,
    20,
    NULL,
    'in_transit',
    12.30
)
ON CONFLICT (route_id, job_id) DO NOTHING;

-- =====================================================
-- SEED TELEMETRY DATA (Sample time-series data)
-- =====================================================

-- Generate telemetry data for the active route over the last 3 hours
-- This creates realistic GPS tracking data

INSERT INTO telemetry (
    time,
    vehicle_id,
    driver_id,
    route_id,
    location,
    speed_kmh,
    heading_degrees,
    odometer_km,
    fuel_level_percent,
    harsh_braking,
    harsh_acceleration,
    speeding
)
SELECT
    CURRENT_TIMESTAMP - (interval '1 second' * generate_series),
    '22222222-2222-2222-2222-222222222222'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'r0000000-0000-0000-0000-000000000001'::uuid,
    ST_GeogFromText(
        'POINT(' ||
        (-122.4194 + (random() * 0.05 - 0.025))::text || ' ' ||
        (37.7749 + (random() * 0.05 - 0.025))::text ||
        ')'
    ),
    (30 + random() * 50)::decimal(6,2),
    (random() * 360)::decimal(5,2),
    (12450.75 + (generate_series * 0.01))::decimal(10,2),
    (95 - (generate_series * 0.001))::decimal(5,2),
    (random() < 0.02)::boolean,
    (random() < 0.02)::boolean,
    (random() < 0.05)::boolean
FROM generate_series(0, 10800, 30);  -- Every 30 seconds for 3 hours

-- Add some stationary periods (idle time)
INSERT INTO telemetry (
    time,
    vehicle_id,
    driver_id,
    route_id,
    location,
    speed_kmh,
    heading_degrees,
    odometer_km,
    fuel_level_percent
)
SELECT
    CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes' + (interval '1 second' * generate_series),
    '22222222-2222-2222-2222-222222222222'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'r0000000-0000-0000-0000-000000000001'::uuid,
    ST_GeogFromText('POINT(-122.4683 37.8199)'),  -- Stationary location
    0::decimal(6,2),
    90::decimal(5,2),
    12458.30::decimal(10,2),
    92.5::decimal(5,2)
FROM generate_series(0, 600, 30);  -- 10 minutes of idle time

-- =====================================================
-- UPDATE STATISTICS
-- =====================================================

-- Update table statistics for query optimization
ANALYZE vehicles;
ANALYZE drivers;
ANALYZE shifts;
ANALYZE jobs;
ANALYZE routes;
ANALYZE route_jobs;
ANALYZE telemetry;

-- =====================================================
-- VERIFICATION QUERIES (commented out)
-- =====================================================

/*
-- Verify seed data
SELECT 'Vehicles' as table_name, COUNT(*) as count FROM vehicles
UNION ALL
SELECT 'Drivers', COUNT(*) FROM drivers
UNION ALL
SELECT 'Shifts', COUNT(*) FROM shifts
UNION ALL
SELECT 'Jobs', COUNT(*) FROM jobs
UNION ALL
SELECT 'Routes', COUNT(*) FROM routes
UNION ALL
SELECT 'Route Jobs', COUNT(*) FROM route_jobs
UNION ALL
SELECT 'Telemetry', COUNT(*) FROM telemetry;

-- Check active route status
SELECT
    r.route_name,
    r.status,
    d.first_name || ' ' || d.last_name as driver,
    v.license_plate,
    r.completed_stops || '/' || r.stops_count as stops_progress
FROM routes r
LEFT JOIN drivers d ON r.driver_id = d.id
LEFT JOIN vehicles v ON r.vehicle_id = v.id
WHERE r.status = 'in_progress';

-- Check job status distribution
SELECT status, COUNT(*) as count
FROM jobs
GROUP BY status
ORDER BY count DESC;
*/

-- End of V3 migration
