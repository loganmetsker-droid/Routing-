-- Migration: Add Phase 3 Option B job workflow fields
-- Date: 2026-01-08

-- Add new lifecycle and billing columns to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS billing_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS billing_notes TEXT,
  ADD COLUMN IF NOT EXISTS invoice_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN jobs.start_date IS 'Actual start date/time for multi-day jobs';
COMMENT ON COLUMN jobs.end_date IS 'End date/time for multi-day jobs (null = same-day)';
COMMENT ON COLUMN jobs.billing_status IS 'Billing status: paid or unpaid';
COMMENT ON COLUMN jobs.billing_amount IS 'Amount to bill (no payment processing)';
COMMENT ON COLUMN jobs.billing_notes IS 'Internal billing notes';
COMMENT ON COLUMN jobs.invoice_ref IS 'External invoice reference';
COMMENT ON COLUMN jobs.customer_id IS 'Reference to customers table for job reuse';
COMMENT ON COLUMN jobs.archived_at IS 'Timestamp when job was archived';

-- Create customers table if not exists
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  default_address TEXT,
  default_address_structured JSONB COMMENT 'Structured default address: { line1, line2, city, state, zip }',
  business_name TEXT,
  notes TEXT,
  exceptions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add index for customer_id foreign key relationship
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);

-- Add index for billing queries
CREATE INDEX IF NOT EXISTS idx_jobs_billing_status ON jobs(billing_status);

-- Add index for archived jobs
CREATE INDEX IF NOT EXISTS idx_jobs_archived_at ON jobs(archived_at);

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_jobs_start_date ON jobs(start_date);
CREATE INDEX IF NOT EXISTS idx_jobs_end_date ON jobs(end_date);

-- Update existing jobs to have default billing status
UPDATE jobs SET billing_status = 'unpaid' WHERE billing_status IS NULL;
