-- ============================================================
-- Utility: idempotently award coins for an action
-- If p_email is NULL, runs for all users with a profile.
-- Usage:
--   SELECT award_coins_once('your@email.com', 10, 'claim_approved', 42);
--   SELECT award_coins_once('your@email.com', 20, 'strava_connected');
--   SELECT award_coins_once(NULL, 20, 'strava_connected');  -- all users
-- ============================================================

DROP FUNCTION IF EXISTS award_coins_once(TEXT, INT, TEXT, INT);

CREATE OR REPLACE FUNCTION award_coins_once(
  p_email  TEXT,
  p_amount INT,
  p_reason TEXT,
  p_ref_id INT DEFAULT NULL
)
RETURNS TABLE(result TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  already_exists BOOLEAN;
BEGIN
  FOR rec IN
    SELECT u.id, u.email
    FROM auth.users u
    JOIN user_profiles up ON up.id = u.id
    WHERE (p_email IS NULL OR u.email = p_email)
      -- For claim_approved: only users with an approved claim
      AND (p_reason != 'claim_approved' OR EXISTS(
        SELECT 1 FROM runner_claims rc
        WHERE rc.user_id = u.id AND rc.status = 'approved'
      ))
      -- For strava_connected: only users who actually connected Strava
      AND (p_reason != 'strava_connected' OR EXISTS(
        SELECT 1 FROM strava_tokens st WHERE st.user_id = u.id
      ))
      -- For event_participation: only users with an approved claim
      AND (p_reason != 'event_participation' OR EXISTS(
        SELECT 1 FROM runner_claims rc
        WHERE rc.user_id = u.id AND rc.status = 'approved'
      ))
  LOOP
    -- Check if already awarded (when ref_id is NULL, match ANY row with same reason)
    IF p_ref_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM coin_transactions ct
        WHERE ct.user_id = rec.id AND ct.reason = p_reason AND ct.ref_id = p_ref_id
      ) INTO already_exists;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM coin_transactions ct
        WHERE ct.user_id = rec.id AND ct.reason = p_reason
      ) INTO already_exists;
    END IF;

    IF already_exists THEN
      result := rec.email || ': already awarded ' || p_reason || COALESCE(' ref=' || p_ref_id, '');
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO coin_transactions (user_id, amount, reason, ref_id)
    VALUES (rec.id, p_amount, p_reason, p_ref_id);

    UPDATE user_profiles
    SET coins = coins + p_amount
    WHERE id = rec.id;

    result := rec.email || ': +' || p_amount || ' for ' || p_reason
      || COALESCE(' ref=' || p_ref_id, '')
      || ' (balance: ' || (SELECT coins FROM user_profiles WHERE id = rec.id) || ')';
    RETURN NEXT;
  END LOOP;

  IF NOT FOUND THEN
    result := 'No users found';
    RETURN NEXT;
  END IF;
END;
$$;
