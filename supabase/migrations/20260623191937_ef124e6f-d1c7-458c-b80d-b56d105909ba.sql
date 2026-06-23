
-- 1. Barcode on wines
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS wines_barcode_unique
  ON public.wines(restaurant_id, barcode)
  WHERE barcode IS NOT NULL;

-- 2. Sessions
CREATE TABLE public.stock_count_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reference_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','closed')),
  notes text,
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scs_restaurant ON public.stock_count_sessions(restaurant_id);
CREATE UNIQUE INDEX idx_scs_one_draft_per_restaurant
  ON public.stock_count_sessions(restaurant_id)
  WHERE status = 'draft';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_count_sessions TO authenticated;
GRANT ALL ON public.stock_count_sessions TO service_role;

ALTER TABLE public.stock_count_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all stock count sessions"
  ON public.stock_count_sessions FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Restaurant manages own stock count sessions"
  ON public.stock_count_sessions FOR ALL
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_scs_updated_at
  BEFORE UPDATE ON public.stock_count_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Items
CREATE TABLE public.stock_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
  wine_id uuid NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  previous_qty int NOT NULL DEFAULT 0,
  counted_qty int,
  counted_at timestamptz,
  counted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, wine_id)
);
CREATE INDEX idx_sci_session ON public.stock_count_items(session_id);
CREATE INDEX idx_sci_wine ON public.stock_count_items(wine_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_count_items TO authenticated;
GRANT ALL ON public.stock_count_items TO service_role;

ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all stock count items"
  ON public.stock_count_items FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Restaurant manages own stock count items"
  ON public.stock_count_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.stock_count_sessions s
    WHERE s.id = stock_count_items.session_id
      AND public.owns_restaurant(auth.uid(), s.restaurant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stock_count_sessions s
    WHERE s.id = stock_count_items.session_id
      AND public.owns_restaurant(auth.uid(), s.restaurant_id)
  ));

CREATE TRIGGER trg_sci_updated_at
  BEFORE UPDATE ON public.stock_count_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
