CREATE TABLE public.price_analysis_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  entree_price numeric NOT NULL,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_analysis_settings TO authenticated;
GRANT ALL ON public.price_analysis_settings TO service_role;

ALTER TABLE public.price_analysis_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view price settings" ON public.price_analysis_settings
FOR SELECT TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.belongs_to_group(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "insert price settings" ON public.price_analysis_settings
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "update price settings" ON public.price_analysis_settings
FOR UPDATE TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()))
WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "delete price settings" ON public.price_analysis_settings
FOR DELETE TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE TRIGGER set_price_analysis_settings_updated_at
BEFORE UPDATE ON public.price_analysis_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();