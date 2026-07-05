ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS pause_seconds integer NOT NULL DEFAULT 0;