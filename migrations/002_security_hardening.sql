-- ============================================================
-- Security hardening — run in Supabase SQL Editor.
-- Safe to re-run. The web app only uses the anon key for auth;
-- every table write goes through the service key (bypasses RLS),
-- so none of the policies/grants removed here are used by the app.
-- ============================================================

-- 1. Utility functions are SECURITY DEFINER and were executable by
--    anon/authenticated through PostgREST (/rest/v1/rpc/...).
--    That allowed anyone with the public anon key to delete users
--    or mint coins. Restrict them to the SQL Editor / service role.
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'delete_user_by_email(text)',
    'award_coins_once(text,integer,text,integer)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END;
$$;

-- 2. user_profiles: the "update own row" policy let a user set their
--    own coins, is_admin, trust_score, verification_level. Profiles are
--    only written server-side, so drop the policy.
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;

-- 3. run_sessions / run_frames: the "service" policies had no TO clause,
--    so USING (true) applied to every role — anyone could read/modify all
--    sessions. service_role bypasses RLS and does not need them.
DROP POLICY IF EXISTS run_sessions_service ON run_sessions;
DROP POLICY IF EXISTS run_frames_service   ON run_frames;

--    Users could flip their own session status (e.g. done → error) to
--    reset the free-analysis quota. Status is only changed server-side.
DROP POLICY IF EXISTS run_sessions_update ON run_sessions;

-- 4. Storage: any signed-in user could upload arbitrary files into the
--    public run-frames bucket. Uploads happen server-side with the
--    service key only.
DROP POLICY IF EXISTS run_frames_upload ON storage.objects;
