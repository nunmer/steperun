-- Add is_key_frame column to run_frames
-- Key frames are analyzed by the LLM, motion frames are for smooth playback only
ALTER TABLE run_frames ADD COLUMN IF NOT EXISTS is_key_frame BOOLEAN DEFAULT true;
