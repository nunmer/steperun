-- ============================================================
-- Atomic coin ledger write — run after add_coin_packs.sql.
-- Inserts the ledger row and adjusts user_profiles.coins in one
-- transaction. Debits only succeed if the balance stays >= 0.
--
-- Returns JSONB: { "status": <status>, "balance": <int> }
--   ok           — applied
--   insufficient — debit would make balance negative (nothing written)
--   duplicate    — unique index hit (ref_id / paddle_transaction_id); nothing written
--   no_profile   — user_profiles row does not exist
-- ============================================================

CREATE OR REPLACE FUNCTION apply_coin_tx(
  p_user_id      UUID,
  p_amount       INT,
  p_reason       TEXT,
  p_ref_id       INT  DEFAULT NULL,
  p_paddle_tx_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INT;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'apply_coin_tx: amount must be non-zero';
  END IF;

  BEGIN
    INSERT INTO coin_transactions (user_id, amount, reason, ref_id, paddle_transaction_id)
    VALUES (p_user_id, p_amount, p_reason, p_ref_id, p_paddle_tx_id);

    -- Single-statement update: row lock prevents lost updates under concurrency.
    UPDATE user_profiles
       SET coins = coins + p_amount
     WHERE id = p_user_id
       AND coins + p_amount >= 0
    RETURNING coins INTO v_balance;

    IF NOT FOUND THEN
      -- Roll back the ledger insert above (block subtransaction).
      RAISE EXCEPTION USING ERRCODE = 'CN001';
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT coins INTO v_balance FROM user_profiles WHERE id = p_user_id;
      RETURN jsonb_build_object('status', 'duplicate', 'balance', COALESCE(v_balance, 0));
    WHEN foreign_key_violation THEN
      RETURN jsonb_build_object('status', 'no_profile', 'balance', 0);
    WHEN SQLSTATE 'CN001' THEN
      SELECT coins INTO v_balance FROM user_profiles WHERE id = p_user_id;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'no_profile', 'balance', 0);
      END IF;
      RETURN jsonb_build_object('status', 'insufficient', 'balance', v_balance);
  END;

  RETURN jsonb_build_object('status', 'ok', 'balance', v_balance);
END;
$$;

-- Server-only: never callable with the public anon key.
REVOKE EXECUTE ON FUNCTION apply_coin_tx(UUID, INT, TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION apply_coin_tx(UUID, INT, TEXT, INT, TEXT) TO service_role;
