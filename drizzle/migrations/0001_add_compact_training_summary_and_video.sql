ALTER TABLE public.wine_story_cards
  ADD COLUMN IF NOT EXISTS compact_summary text,
  ADD COLUMN IF NOT EXISTS video_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS video_job_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_script jsonb,
  ADD COLUMN IF NOT EXISTS video_error text,
  ADD COLUMN IF NOT EXISTS video_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_updated_at timestamptz;

ALTER TABLE public.wine_story_cards
  ADD CONSTRAINT wine_story_cards_video_status_check
  CHECK (video_status IN ('none', 'creating', 'processing', 'draft', 'published', 'failed'));

CREATE INDEX IF NOT EXISTS wine_story_cards_video_status_idx
  ON public.wine_story_cards (restaurant_id, video_status);