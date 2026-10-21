-- 004: event organizer, shown on the events list and event pages.
-- ADD COLUMN without a default is metadata-only: instant, safe while the
-- scraper is running. New events get the organizer from the scraper.

ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer TEXT;

UPDATE events SET organizer = 'Athletex'
WHERE organizer IS NULL AND slug LIKE 'athletex\_%';

UPDATE events SET organizer = 'Almaty Marathon'
WHERE organizer IS NULL AND url LIKE '%almaty-marathon.kz%';

-- Check: every event should have an organizer.
SELECT organizer, count(*) FROM events GROUP BY organizer ORDER BY organizer;
