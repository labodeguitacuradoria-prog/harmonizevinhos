CREATE OR REPLACE FUNCTION public.auto_submit_to_catalog()
RETURNS trigger
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

  IF NEW.barcode IS NOT NULL AND length(trim(NEW.barcode)) > 0 THEN
    SELECT id INTO match_id FROM public.wine_catalog
    WHERE barcode = NEW.barcode AND status = 'approved' LIMIT 1;
  END IF;

  IF match_id IS NULL THEN
    SELECT id INTO match_id FROM public.wine_catalog
    WHERE lower(name) = lower(NEW.name)
      AND lower(coalesce(producer, '')) = lower(coalesce(NEW.producer, ''))
      AND coalesce(vintage, 0) = coalesce(NEW.vintage, 0)
    LIMIT 1;
  END IF;

  IF match_id IS NOT NULL THEN
    NEW.catalog_id := match_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.wine_catalog (
    name, producer, vintage, region, appellation, country, grape, wine_type, style, volume,
    barcode, alcohol_pct, sugar_level, sugar_g_l, body, tannin, acidity,
    acidity_g_l, acidity_ph, elaboration, aging, serving_temp_min, serving_temp_max,
    pairing_notes, tasting_notes, awards, image_url, gallery_urls, tech_sheet_url,
    videos, suggested_retail_price, status, submitted_by, source_restaurant_id
  ) VALUES (
    NEW.name, NEW.producer, NEW.vintage, NEW.region, NEW.appellation, NEW.country, NEW.grape,
    NEW.wine_type, NEW.style, NEW.volume, NEW.barcode, NEW.alcohol_pct,
    NEW.sugar_level, NEW.sugar_g_l, NEW.body, NEW.tannin, NEW.acidity,
    NEW.acidity_g_l, NEW.acidity_ph, NEW.elaboration, NEW.aging,
    NEW.serving_temp_min, NEW.serving_temp_max, NEW.pairing_notes,
    NEW.tasting_notes, NEW.awards, NEW.image_url, NEW.gallery_urls,
    NEW.tech_sheet_url, COALESCE(NEW.videos, '[]'::jsonb),
    NEW.suggested_retail_price,
    'pending'::catalog_status, auth.uid(), NEW.restaurant_id
  )
  RETURNING id INTO new_catalog_id;

  NEW.catalog_id := new_catalog_id;
  RETURN NEW;
END;
$$;

UPDATE public.wine_catalog c
SET suggested_retail_price = NULL, updated_at = now()
WHERE c.suggested_retail_price IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.wines w
    WHERE w.catalog_id = c.id
      AND w.sale_price = c.suggested_retail_price
      AND (w.suggested_retail_price IS NULL OR w.suggested_retail_price <> w.sale_price)
  );