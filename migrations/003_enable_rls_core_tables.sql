-- ============================================================
-- Enable RLS on the core results tables (Supabase advisor:
-- rls_disabled_in_public). Run in Supabase SQL Editor; safe to re-run.
--
-- The web app and the scraper both use the service key, which bypasses
-- RLS, so no policies are needed. With RLS on and no policies, the public
-- anon key can no longer read, edit or delete these tables directly.
-- ============================================================

ALTER TABLE runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Views run with the owner's rights by default, which would bypass RLS
-- and keep exposing the joined data. Make v_results respect the caller.
ALTER VIEW v_results SET (security_invoker = true);

-- Check: any public table still without RLS (should return no rows).
SELECT c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity;
