CREATE TABLE public.printed_wine_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Carta de Vinhos',
  template text NOT NULL DEFAULT 'classic',
  header_title text,
  header_subtitle text,
  footer_text text,
  visible_fields jsonb NOT NULL DEFAULT '{"producer":true,"vintage":true,"origin":true,"grape":false,"volume":true,"price":true}'::jsonb,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printed_wine_lists TO authenticated;
GRANT ALL ON public.printed_wine_lists TO service_role;

ALTER TABLE public.printed_wine_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view printed wine lists"
  ON public.printed_wine_lists FOR SELECT TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can create printed wine lists"
  ON public.printed_wine_lists FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can update printed wine lists"
  ON public.printed_wine_lists FOR UPDATE TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can delete printed wine lists"
  ON public.printed_wine_lists FOR DELETE TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE INDEX idx_printed_wine_lists_restaurant ON public.printed_wine_lists(restaurant_id);

CREATE TRIGGER printed_wine_lists_set_updated_at
  BEFORE UPDATE ON public.printed_wine_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();