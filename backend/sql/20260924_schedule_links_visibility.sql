-- Preserve existing visibility; allow links to be hidden without changing their period.
ALTER TABLE schedule_links ADD COLUMN IF NOT EXISTS is_enabled TINYINT(1) NOT NULL DEFAULT 1;
