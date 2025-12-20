-- =====================================================
-- Docker Init Script - Database Setup
-- Routing & Dispatching SaaS Platform
-- =====================================================

-- This script runs automatically when the PostgreSQL container
-- is first initialized. It sets up required extensions.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialized with extensions: uuid-ossp, timescaledb';
END $$;

-- Note: Full schema migrations should be run separately using the migration scripts
-- located in backend/src/database/migrations/