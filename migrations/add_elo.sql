-- Add ELO rating columns to runners table
-- Run this in Supabase SQL Editor

ALTER TABLE runners ADD COLUMN IF NOT EXISTS elo_score INTEGER DEFAULT NULL;
ALTER TABLE runners ADD COLUMN IF NOT EXISTS elo_level INTEGER DEFAULT NULL;
ALTER TABLE runners ADD COLUMN IF NOT EXISTS elo_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Index for sorting by ELO
CREATE INDEX IF NOT EXISTS idx_runners_elo ON runners(elo_score DESC NULLS LAST);
