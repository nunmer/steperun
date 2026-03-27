-- ============================================================
-- Runner Profile Claiming System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. user_profiles — one row per auth.users entry
CREATE TABLE IF NOT EXISTS user_profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  trust_score        INT NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
  verification_level SMALLINT NOT NULL DEFAULT 0 CHECK (verification_level BETWEEN 0 AND 4),
  is_admin           BOOL NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. strava_tokens — one row per user
CREATE TABLE IF NOT EXISTS strava_tokens (
  user_id        UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  athlete_id     BIGINT UNIQUE NOT NULL,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  scope          TEXT,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);

-- 3. runner_claims
CREATE TABLE IF NOT EXISTS runner_claims (
  id                   SERIAL PRIMARY KEY,
  runner_id            INT NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected','disputed','superseded')),
  trust_score_at_claim INT NOT NULL DEFAULT 0,
  auto_approved        BOOL NOT NULL DEFAULT FALSE,
  strava_match_score   INT,
  strava_match_detail  JSONB,
  evidence             JSONB,
  reviewed_by          UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ,
  review_notes         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active claim per runner: prevents double-claims at DB level
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_claim_per_runner
  ON runner_claims (runner_id)
  WHERE status IN ('pending', 'approved');

-- 4. runner_claim_evidence
CREATE TABLE IF NOT EXISTS runner_claim_evidence (
  id          SERIAL PRIMARY KEY,
  claim_id    INT NOT NULL REFERENCES runner_claims(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('screenshot','gpx','strava_activity','other')),
  url         TEXT NOT NULL,
  notes       TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. disputes
CREATE TABLE IF NOT EXISTS disputes (
  id                  SERIAL PRIMARY KEY,
  original_claim_id   INT NOT NULL REFERENCES runner_claims(id) ON DELETE CASCADE,
  disputing_user_id   UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','resolved_demoted','resolved_upheld','admin_decision')),
  reason              TEXT NOT NULL,
  evidence            JSONB,
  resolved_by         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  resolution_notes    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. claim_audit_log — append-only
CREATE TABLE IF NOT EXISTS claim_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id    UUID,
  runner_id  INT,
  claim_id   INT,
  ip_address INET,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. rate_limit_log
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID,
  ip_address INET,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user   ON rate_limit_log (user_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip     ON rate_limit_log (ip_address, action, created_at);
CREATE INDEX IF NOT EXISTS idx_claims_runner     ON runner_claims (runner_id);
CREATE INDEX IF NOT EXISTS idx_claims_user       ON runner_claims (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_claim       ON claim_audit_log (claim_id);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON claim_audit_log (user_id);

-- 8. Add claimed_by to runners
ALTER TABLE runners
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE user_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE runner_claims     ENABLE ROW LEVEL SECURITY;
ALTER TABLE runner_claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log    ENABLE ROW LEVEL SECURITY;

-- user_profiles: own row + admins read all
CREATE POLICY "users_read_own_profile"   ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own_profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins_read_all_profiles" ON user_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- strava_tokens: own row only
CREATE POLICY "users_own_strava" ON strava_tokens FOR ALL USING (auth.uid() = user_id);

-- runner_claims: own claims + admins all
CREATE POLICY "users_read_own_claims" ON runner_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_all_claims"     ON runner_claims FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- runner_claim_evidence: own evidence via claim
CREATE POLICY "users_own_evidence" ON runner_claim_evidence FOR ALL
  USING (EXISTS (SELECT 1 FROM runner_claims WHERE id = claim_id AND user_id = auth.uid()));

-- disputes: own disputes
CREATE POLICY "users_read_own_disputes" ON disputes FOR SELECT USING (auth.uid() = disputing_user_id);
CREATE POLICY "admins_all_disputes"     ON disputes FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- claim_audit_log: admins read only (writes via service key only)
CREATE POLICY "admins_read_audit" ON claim_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- rate_limit_log: service key only (no user policies needed)
