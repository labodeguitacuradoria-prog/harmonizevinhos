ALTER TABLE public.printed_wine_lists
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS address_text text,
  ADD COLUMN IF NOT EXISTS paper_size text NOT NULL DEFAULT 'a4';