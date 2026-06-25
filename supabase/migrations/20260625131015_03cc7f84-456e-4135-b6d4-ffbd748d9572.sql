
-- 1. Migrate existing 'restaurant' role users → 'rest_admin'
INSERT INTO public.user_roles (user_id, role, restaurant_id)
SELECT user_id, 'rest_admin'::public.app_role, restaurant_id
FROM public.user_roles
WHERE role = 'restaurant'
ON CONFLICT (user_id, role, restaurant_id, supplier_id) DO NOTHING;

-- 2. Update signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_restaurant_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.restaurants (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'Meu Restaurante'), NEW.id)
  RETURNING id INTO new_restaurant_id;

  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  VALUES (NEW.id, 'rest_admin'::public.app_role, new_restaurant_id)
  ON CONFLICT (user_id, role, restaurant_id, supplier_id) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Helper
CREATE OR REPLACE FUNCTION public.can_manage_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND restaurant_id = _restaurant_id
        AND role IN ('rest_admin'::public.app_role, 'rest_owner'::public.app_role, 'restaurant'::public.app_role)
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = _restaurant_id AND owner_id = _user_id
    );
$$;

-- 4. Trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 5. Wine catalog
DO $$ BEGIN
  CREATE TYPE public.catalog_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.wine_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  producer TEXT,
  vintage INTEGER,
  region TEXT,
  country TEXT,
  grape TEXT,
  wine_type TEXT,
  volume TEXT,
  volume_ml INTEGER,
  barcode TEXT,
  alcohol_pct NUMERIC,
  sugar_level TEXT,
  body TEXT,
  tannin TEXT,
  acidity TEXT,
  aging TEXT,
  serving_temp_min INTEGER,
  serving_temp_max INTEGER,
  pairing_notes TEXT,
  tasting_notes TEXT,
  awards TEXT[],
  image_url TEXT,
  gallery_urls TEXT[],
  tech_sheet_url TEXT,
  video_url TEXT,
  status public.catalog_status NOT NULL DEFAULT 'pending',
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wine_catalog TO authenticated;
GRANT ALL ON public.wine_catalog TO service_role;

ALTER TABLE public.wine_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view approved or own submissions" ON public.wine_catalog;
CREATE POLICY "view approved or own submissions"
ON public.wine_catalog FOR SELECT TO authenticated
USING (
  status = 'approved'
  OR submitted_by = auth.uid()
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "authenticated can submit" ON public.wine_catalog;
CREATE POLICY "authenticated can submit"
ON public.wine_catalog FOR INSERT TO authenticated
WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "system owner can update" ON public.wine_catalog;
CREATE POLICY "system owner can update"
ON public.wine_catalog FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "system owner can delete" ON public.wine_catalog;
CREATE POLICY "system owner can delete"
ON public.wine_catalog FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_wine_catalog_updated_at ON public.wine_catalog;
CREATE TRIGGER trg_wine_catalog_updated_at
BEFORE UPDATE ON public.wine_catalog
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS wine_catalog_name_trgm ON public.wine_catalog USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS wine_catalog_producer_trgm ON public.wine_catalog USING gin (producer gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS wine_catalog_barcode_uniq ON public.wine_catalog (barcode) WHERE barcode IS NOT NULL AND status = 'approved';
CREATE INDEX IF NOT EXISTS wine_catalog_status_idx ON public.wine_catalog (status);

-- 6. Link local wines to catalog
ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES public.wine_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wines_catalog_id_idx ON public.wines(catalog_id);
