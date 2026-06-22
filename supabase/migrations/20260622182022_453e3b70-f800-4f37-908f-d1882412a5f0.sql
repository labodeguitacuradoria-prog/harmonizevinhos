
CREATE TABLE public.product_categories (
  slug text PRIMARY KEY,
  label_pt text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_categories TO authenticated, anon;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories readable by everyone"
  ON public.product_categories FOR SELECT
  USING (true);

INSERT INTO public.product_categories (slug, label_pt, icon, sort_order, active) VALUES
  ('wine', 'Vinhos', 'Wine', 1, true),
  ('glass', 'Taças', 'GlassWater', 2, true),
  ('decanter', 'Decanters', 'FlaskConical', 3, false),
  ('corkscrew', 'Saca-rolhas', 'Wrench', 4, false),
  ('menu', 'Cartas', 'BookOpen', 5, false),
  ('accessory', 'Acessórios', 'Package', 6, false);

ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS alcohol_pct numeric(4,2),
  ADD COLUMN IF NOT EXISTS sugar_level text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS tannin text,
  ADD COLUMN IF NOT EXISTS acidity text,
  ADD COLUMN IF NOT EXISTS aging text,
  ADD COLUMN IF NOT EXISTS serving_temp_min int,
  ADD COLUMN IF NOT EXISTS serving_temp_max int,
  ADD COLUMN IF NOT EXISTS pairing_notes text,
  ADD COLUMN IF NOT EXISTS tasting_notes text,
  ADD COLUMN IF NOT EXISTS awards text[],
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS gallery_urls text[],
  ADD COLUMN IF NOT EXISTS tech_sheet_url text,
  ADD COLUMN IF NOT EXISTS video_url text;

CREATE TABLE public.glasses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  capacity_ml int,
  wine_type_recommended text,
  material text,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  stock_quantity int NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_glasses_restaurant ON public.glasses(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.glasses TO authenticated;
GRANT ALL ON public.glasses TO service_role;

ALTER TABLE public.glasses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all glasses"
  ON public.glasses FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Restaurant manages own glasses"
  ON public.glasses FOR ALL
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owner views group glasses"
  ON public.glasses FOR SELECT
  USING (public.belongs_to_group(auth.uid(), restaurant_id));

CREATE TRIGGER trg_glasses_updated_at
  BEFORE UPDATE ON public.glasses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated read product-media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-media');

CREATE POLICY "Authenticated upload product-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-media');

CREATE POLICY "Authenticated update product-media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-media');

CREATE POLICY "Authenticated delete product-media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-media');
