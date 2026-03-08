-- ============================================================
-- Almaty Marathon Runner Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Events: one row per race event (e.g. "almaty_marathon_2025")
CREATE TABLE IF NOT EXISTS events (
    id          SERIAL PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,   -- e.g. "winter_run_2026"
    name        TEXT NOT NULL,          -- human-readable name
    year        INTEGER,
    url         TEXT NOT NULL,
    date_of_event DATE,
    scraped_at  TIMESTAMPTZ,
    total_results INTEGER DEFAULT 0
);

-- Runners: deduplicated across all events
-- A runner is identified by (full_name, country, city)
CREATE TABLE IF NOT EXISTS runners (
    id          SERIAL PRIMARY KEY,
    full_name   TEXT NOT NULL,
    country     TEXT,
    city        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(full_name, country, city)
);

-- Results: one row per runner per distance category per event
CREATE TABLE IF NOT EXISTS results (
    id                  SERIAL PRIMARY KEY,
    runner_id           INTEGER NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
    event_id            INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bib_number          TEXT,
    distance_category   TEXT,           -- e.g. "10 км", "42 км", "Скандинавская ходьба: 7 км"
    place               INTEGER,        -- overall place within category
    checkpoint_times    JSONB,          -- e.g. ["00:15:32", "00:30:11", "00:45:00"]
    finish_time         TEXT,           -- gun time e.g. "01:23:45"
    chip_time           TEXT,           -- chip time e.g. "01:23:40"
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    -- unique: one result per bib per category per event
    UNIQUE(event_id, bib_number, distance_category)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_results_runner   ON results(runner_id);
CREATE INDEX IF NOT EXISTS idx_results_event    ON results(event_id);
CREATE INDEX IF NOT EXISTS idx_results_place    ON results(place);
CREATE INDEX IF NOT EXISTS idx_results_category ON results(distance_category);
CREATE INDEX IF NOT EXISTS idx_runners_name     ON runners(full_name);
CREATE INDEX IF NOT EXISTS idx_events_year      ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_slug      ON events(slug);

-- View: flat view for easy querying
CREATE OR REPLACE VIEW v_results AS
SELECT
    r.full_name,
    r.country,
    r.city,
    e.name         AS event_name,
    e.slug         AS event_slug,
    e.year,
    res.distance_category,
    res.bib_number,
    res.place,
    res.finish_time,
    res.chip_time,
    res.checkpoint_times
FROM results res
JOIN runners r ON r.id = res.runner_id
JOIN events  e ON e.id = res.event_id;
