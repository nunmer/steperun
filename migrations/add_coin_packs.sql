-- ============================================================
-- Coin purchases (Paddle integration)
-- Run after add_coins.sql
-- ============================================================

-- Paddle transaction IDs are strings — current ref_id column is INT.
-- Add a dedicated column with a unique index for idempotent crediting.
ALTER TABLE coin_transactions
  ADD COLUMN IF NOT EXISTS paddle_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_tx_paddle_unique
  ON coin_transactions(paddle_transaction_id)
  WHERE paddle_transaction_id IS NOT NULL;
