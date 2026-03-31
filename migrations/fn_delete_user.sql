-- ============================================================
-- Utility: fully delete a user and all related data
-- Usage:  SELECT delete_user_by_email('your@email.com');
-- ============================================================

CREATE OR REPLACE FUNCTION delete_user_by_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = p_email;
  IF uid IS NULL THEN
    RETURN 'User not found: ' || p_email;
  END IF;

  UPDATE runners SET claimed_by = NULL WHERE claimed_by = uid;

  DELETE FROM runner_claim_evidence WHERE claim_id IN (
    SELECT id FROM runner_claims WHERE user_id = uid
  );
  DELETE FROM disputes WHERE disputing_user_id = uid;
  DELETE FROM coin_transactions WHERE user_id = uid;
  DELETE FROM runner_claims WHERE user_id = uid;
  DELETE FROM claim_audit_log WHERE user_id = uid;
  DELETE FROM rate_limit_log WHERE user_id = uid;
  DELETE FROM strava_tokens WHERE user_id = uid;
  DELETE FROM user_profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;

  RETURN 'Deleted user ' || p_email || ' (' || uid || ')';
END;
$$;
