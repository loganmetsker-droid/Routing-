-- Script to seed sample telemetry data for testing vehicle tracking
-- This creates sample GPS data for existing vehicles

-- First, check if we have vehicles
DO $$
DECLARE
    vehicle_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO vehicle_count FROM vehicles;

    IF vehicle_count = 0 THEN
        RAISE NOTICE 'No vehicles found. Please create vehicles first.';
    ELSE
        RAISE NOTICE 'Found % vehicles. Creating telemetry data...', vehicle_count;

        -- Insert sample telemetry data for each vehicle
        -- San Francisco Bay Area coordinates
        INSERT INTO telemetry (vehicle_id, location, speed, heading, timestamp)
        SELECT
            v.id as vehicle_id,
            ST_GeogFromText('POINT(' ||
                (-122.4 + (random() * 0.1))::text || ' ' ||
                (37.75 + (random() * 0.1))::text ||
            ')') as location,
            (30 + random() * 50)::decimal(5,2) as speed,
            (random() * 360)::decimal(5,2) as heading,
            NOW() - (random() * interval '5 minutes') as timestamp
        FROM vehicles v
        WHERE v.status IN ('available', 'in_route')
        LIMIT 10;

        -- Add a few more data points for each vehicle to show movement
        INSERT INTO telemetry (vehicle_id, location, speed, heading, timestamp)
        SELECT
            v.id as vehicle_id,
            ST_GeogFromText('POINT(' ||
                (-122.4 + (random() * 0.1))::text || ' ' ||
                (37.75 + (random() * 0.1))::text ||
            ')') as location,
            (30 + random() * 50)::decimal(5,2) as speed,
            (random() * 360)::decimal(5,2) as heading,
            NOW() - (random() * interval '10 minutes') as timestamp
        FROM vehicles v
        WHERE v.status IN ('available', 'in_route')
        LIMIT 10;

        RAISE NOTICE 'Sample telemetry data created successfully!';
    END IF;
END $$;

-- Verify the data
SELECT
    v.license_plate,
    v.status,
    COUNT(t.id) as telemetry_records,
    MAX(t.timestamp) as latest_update
FROM vehicles v
LEFT JOIN telemetry t ON t.vehicle_id = v.id
GROUP BY v.id, v.license_plate, v.status
ORDER BY latest_update DESC NULLS LAST;
