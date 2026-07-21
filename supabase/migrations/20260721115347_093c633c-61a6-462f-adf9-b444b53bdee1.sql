
CREATE TABLE public.corkage_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reference_year INT NOT NULL,
  reference_month INT NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  quantity INT NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, reference_year, reference_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corkage_fees TO authenticated;
GRANT ALL ON public.corkage_fees TO service_role;

ALTER TABLE public.corkage_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant members can view corkage fees"
  ON public.corkage_fees FOR SELECT
  TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant members can insert corkage fees"
  ON public.corkage_fees FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant members can update corkage fees"
  ON public.corkage_fees FOR UPDATE
  TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant members can delete corkage fees"
  ON public.corkage_fees FOR DELETE
  TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_corkage_fees_updated_at
  BEFORE UPDATE ON public.corkage_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
