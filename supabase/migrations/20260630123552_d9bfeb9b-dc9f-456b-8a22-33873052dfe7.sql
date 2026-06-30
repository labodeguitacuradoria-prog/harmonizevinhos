
-- 1. New columns on wine_catalog
ALTER TABLE public.wine_catalog
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS sugar_g_l numeric,
  ADD COLUMN IF NOT EXISTS acidity_g_l numeric,
  ADD COLUMN IF NOT EXISTS acidity_ph numeric,
  ADD COLUMN IF NOT EXISTS elaboration text,
  ADD COLUMN IF NOT EXISTS suppliers text[],
  ADD COLUMN IF NOT EXISTS videos jsonb DEFAULT '[]'::jsonb;

-- 2. Mirror on wines
ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS sugar_g_l numeric,
  ADD COLUMN IF NOT EXISTS acidity_g_l numeric,
  ADD COLUMN IF NOT EXISTS acidity_ph numeric,
  ADD COLUMN IF NOT EXISTS elaboration text,
  ADD COLUMN IF NOT EXISTS videos jsonb DEFAULT '[]'::jsonb;

-- 3. Auto-submit trigger: when a wine is inserted without a catalog_id, find or create a pending catalog entry.
CREATE OR REPLACE FUNCTION public.auto_submit_to_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_id uuid;
  new_catalog_id uuid;
BEGIN
  IF NEW.catalog_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try barcode match (approved only)
  IF NEW.barcode IS NOT NULL AND length(trim(NEW.barcode)) > 0 THEN
    SELECT id INTO match_id
    FROM public.wine_catalog
    WHERE barcode = NEW.barcode AND status = 'approved'
    LIMIT 1;
  END IF;

  -- Otherwise try name+producer+vintage match (any status)
  IF match_id IS NULL THEN
    SELECT id INTO match_id
    FROM public.wine_catalog
    WHERE lower(name) = lower(NEW.name)
      AND lower(coalesce(producer, '')) = lower(coalesce(NEW.producer, ''))
      AND coalesce(vintage, 0) = coalesce(NEW.vintage, 0)
    LIMIT 1;
  END IF;

  IF match_id IS NOT NULL THEN
    NEW.catalog_id := match_id;
    RETURN NEW;
  END IF;

  -- Create a pending entry
  INSERT INTO public.wine_catalog (
    name, producer, vintage, region, country, grape, wine_type, style, volume,
    barcode, alcohol_pct, sugar_level, sugar_g_l, body, tannin, acidity,
    acidity_g_l, acidity_ph, elaboration, aging, serving_temp_min, serving_temp_max,
    pairing_notes, tasting_notes, awards, image_url, gallery_urls, tech_sheet_url,
    videos, status, submitted_by, source_restaurant_id
  ) VALUES (
    NEW.name, NEW.producer, NEW.vintage, NEW.region, NEW.country, NEW.grape,
    NEW.wine_type, NEW.style, NEW.volume, NEW.barcode, NEW.alcohol_pct,
    NEW.sugar_level, NEW.sugar_g_l, NEW.body, NEW.tannin, NEW.acidity,
    NEW.acidity_g_l, NEW.acidity_ph, NEW.elaboration, NEW.aging,
    NEW.serving_temp_min, NEW.serving_temp_max, NEW.pairing_notes,
    NEW.tasting_notes, NEW.awards, NEW.image_url, NEW.gallery_urls,
    NEW.tech_sheet_url, COALESCE(NEW.videos, '[]'::jsonb),
    'pending'::catalog_status, auth.uid(), NEW.restaurant_id
  )
  RETURNING id INTO new_catalog_id;

  NEW.catalog_id := new_catalog_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wines_auto_submit_catalog ON public.wines;
CREATE TRIGGER trg_wines_auto_submit_catalog
  BEFORE INSERT ON public.wines
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_submit_to_catalog();
