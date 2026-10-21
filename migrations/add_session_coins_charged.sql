-- ============================================================
-- Track coins charged per run session so stale-session cleanup
-- knows how much to refund. Run after fn_apply_coin_tx.sql.
-- ============================================================

ALTER TABLE run_sessions
  ADD COLUMN IF NOT EXISTS coins_charged INT NOT NULL DEFAULT 0 CHECK (coins_charged >= 0);

-- Cleanup scans a user's sessions by status + age.
CREATE INDEX IF NOT EXISTS idx_run_sessions_user_status_updated
  ON run_sessions(user_id, status, updated_at);
