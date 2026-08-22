CREATE TABLE public.price_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  entree_price numeric NOT NULL DEFAULT 0,
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_simulations TO authenticated;
GRANT ALL ON public.price_simulations TO service_role;

ALTER TABLE public.price_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view simulations" ON public.price_simulations
  FOR SELECT TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can create simulations" ON public.price_simulations
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can update simulations" ON public.price_simulations
  FOR UPDATE TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can delete simulations" ON public.price_simulations
  FOR DELETE TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER price_simulations_set_updated_at
  BEFORE UPDATE ON public.price_simulations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_price_simulations_restaurant ON public.price_simulations(restaurant_id, updated_at DESC);