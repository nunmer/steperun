-- ============================================================================
-- 006: app_settings, a small key/value store for settings admins edit at
-- runtime: the claim-email sender and the claim-email text on /admin/emails.
--
-- Service key only: RLS on, no policies, so anon/authenticated see nothing.
-- Safe to re-run. The web falls back to defaults until this is applied.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_settings FROM anon, authenticated;
