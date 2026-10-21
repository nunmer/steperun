-- ============================================================
-- Run Analyzer: video-based running technique analysis
-- ============================================================

-- Sessions: one row per analysis session
CREATE TABLE IF NOT EXISTS run_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'Untitled session',
    status      TEXT NOT NULL DEFAULT 'extracting'
                CHECK (status IN ('extracting','extracted','analyzing','done','error')),
    frame_count INTEGER DEFAULT 0,
    analysis    JSONB,               -- full LLM analysis result
    overall_score INTEGER,           -- 0-100 denormalized for sorting
    provider    TEXT DEFAULT 'aws',   -- 'aws' or 'openai'
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Frames: extracted key frames per session
CREATE TABLE IF NOT EXISTS run_frames (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES run_sessions(id) ON DELETE CASCADE,
    idx         INTEGER NOT NULL,     -- ordering index
    phase       TEXT NOT NULL,        -- foot_strike, mid_stance, toe_off, flight
    frame_number INTEGER NOT NULL,    -- original video frame index
    timestamp_ms FLOAT NOT NULL,
    image_path  TEXT NOT NULL,        -- Supabase Storage path
    landmarks   JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_run_sessions_user   ON run_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_frames_session   ON run_frames(session_id, idx);

-- RLS policies
ALTER TABLE run_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_frames   ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY run_sessions_select ON run_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY run_sessions_insert ON run_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No user UPDATE policy: status transitions are server-side only (quota/billing depend on them).

-- Users can only see frames from their own sessions
CREATE POLICY run_frames_select ON run_frames
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM run_sessions WHERE id = run_frames.session_id AND user_id = auth.uid())
    );
CREATE POLICY run_frames_insert ON run_frames
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM run_sessions WHERE id = run_frames.session_id AND user_id = auth.uid())
    );

-- service_role bypasses RLS — no extra policy needed. (A FOR ALL USING (true)
-- policy without a TO clause would open the tables to every role.)

-- Storage bucket for run analyzer frames
INSERT INTO storage.buckets (id, name, public)
VALUES ('run-frames', 'run-frames', true)
ON CONFLICT (id) DO NOTHING;

-- Uploads happen server-side with the service key; no user upload policy.
CREATE POLICY run_frames_read ON storage.objects
    FOR SELECT USING (bucket_id = 'run-frames');
