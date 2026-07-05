
ALTER TABLE public.wine_catalog
  ADD COLUMN IF NOT EXISTS grapes_detail jsonb,
  ADD COLUMN IF NOT EXISTS oak_months numeric,
  ADD COLUMN IF NOT EXISTS production_method text,
  ADD COLUMN IF NOT EXISTS source_text text,
  ADD COLUMN IF NOT EXISTS source_file_url text,
  ADD COLUMN IF NOT EXISTS extracted_by_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_notes text;
