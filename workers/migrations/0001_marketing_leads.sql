CREATE TABLE IF NOT EXISTS marketing_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  company TEXT NOT NULL,
  fleet_size TEXT NOT NULL,
  exact_fleet_size INTEGER,
  request_type TEXT NOT NULL,
  notes TEXT,
  source TEXT NOT NULL,
  page_path TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notification_status TEXT NOT NULL DEFAULT 'pending',
  notification_error TEXT,
  notification_message_id TEXT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_created_at
  ON marketing_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_email_created_at
  ON marketing_leads(work_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_ip_created_at
  ON marketing_leads(ip_hash, created_at DESC);
