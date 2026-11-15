ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS table_pitch text;
ALTER TABLE public.wine_catalog ADD COLUMN IF NOT EXISTS table_pitch text;
ALTER TABLE public.training_books
  ADD COLUMN IF NOT EXISTS quick_title text,
  ADD COLUMN IF NOT EXISTS quick_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quick_pdf_path text,
  ADD COLUMN IF NOT EXISTS quick_published_at timestamptz;