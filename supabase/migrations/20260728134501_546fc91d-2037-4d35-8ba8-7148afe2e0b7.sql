
CREATE TABLE public.dashboard_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  indicator text NOT NULL,
  reference_year integer NOT NULL,
  reference_month integer,
  target_value numeric NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_targets_month_range CHECK (reference_month IS NULL OR (reference_month BETWEEN 1 AND 12))
);

CREATE UNIQUE INDEX dashboard_targets_unique
  ON public.dashboard_targets (restaurant_id, indicator, reference_year, COALESCE(reference_month, 0));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_targets TO authenticated;
GRANT ALL ON public.dashboard_targets TO service_role;

ALTER TABLE public.dashboard_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_targets_manage"
  ON public.dashboard_targets FOR ALL TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER dashboard_targets_set_updated_at
  BEFORE UPDATE ON public.dashboard_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
