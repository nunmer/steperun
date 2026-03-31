-- ============================================================
-- Coins System
-- Run this in Supabase SQL Editor after add_claims.sql
-- ============================================================

-- 1. Add coins balance to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0 CHECK (coins >= 0);

-- 2. coin_transactions — append-only ledger of all coin changes
CREATE TABLE IF NOT EXISTS coin_transactions (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount     INT NOT NULL,          -- positive = credit, negative = debit
  reason     TEXT NOT NULL,         -- 'claim_approved', 'strava_connected', 'event_participation'
  ref_id     INT,                   -- optional: claim_id, event_id, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_reason ON coin_transactions(user_id, reason);

-- Prevent duplicate rewards: unique per (user_id, reason, ref_id)
-- e.g. only one 'claim_approved' reward per claim, one 'event_participation' per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_tx_unique_reward
  ON coin_transactions(user_id, reason, ref_id)
  WHERE ref_id IS NOT NULL;

-- 3. RLS policies
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
CREATE POLICY coin_tx_select_own ON coin_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Only service key can insert (via server-side code)
CREATE POLICY coin_tx_insert_service ON coin_transactions
  FOR INSERT WITH CHECK (false);
-- Service key bypasses RLS, so server-side inserts work fine.
