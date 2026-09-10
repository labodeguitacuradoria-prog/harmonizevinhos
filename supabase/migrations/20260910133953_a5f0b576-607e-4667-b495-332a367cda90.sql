CREATE TYPE public.app_module AS ENUM ('full', 'dashboard', 'pricing', 'printed_menu', 'pairing');
CREATE TYPE public.entitlement_source AS ENUM ('admin', 'subscription', 'trial');

CREATE TABLE public.module_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  source public.entitlement_source NOT NULL DEFAULT 'admin',
  expires_at timestamp with time zone,
  granted_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, module)
);

GRANT SELECT ON public.module_entitlements TO authenticated;
GRANT ALL ON public.module_entitlements TO service_role;

ALTER TABLE public.module_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view restaurant modules"
ON public.module_entitlements FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.can_manage_restaurant(auth.uid(), restaurant_id)
  OR public.belongs_to_group(auth.uid(), restaurant_id)
);

CREATE TRIGGER set_module_entitlements_updated_at
BEFORE UPDATE ON public.module_entitlements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.module_entitlements (restaurant_id, module, enabled, source)
SELECT id, 'full'::public.app_module, true, 'admin'::public.entitlement_source
FROM public.restaurants
ON CONFLICT (restaurant_id, module) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_full_module_on_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.module_entitlements (restaurant_id, module, enabled, source)
  VALUES (NEW.id, 'full', true, 'admin')
  ON CONFLICT (restaurant_id, module) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurants_grant_full_module
AFTER INSERT ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.grant_full_module_on_restaurant();