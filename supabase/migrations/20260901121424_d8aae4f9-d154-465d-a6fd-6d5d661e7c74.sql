CREATE TYPE public.access_link_scope AS ENUM ('dashboard', 'stock_count');
CREATE TYPE public.access_link_device_kind AS ENUM ('mobile', 'desktop');

CREATE TABLE public.access_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  scope public.access_link_scope NOT NULL DEFAULT 'dashboard',
  device_kind public.access_link_device_kind NOT NULL DEFAULT 'mobile',
  single_device boolean NOT NULL DEFAULT true,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_links TO authenticated;
GRANT ALL ON public.access_links TO service_role;

ALTER TABLE public.access_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view access links"
  ON public.access_links FOR SELECT TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can create access links"
  ON public.access_links FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can update access links"
  ON public.access_links FOR UPDATE TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers can delete access links"
  ON public.access_links FOR DELETE TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER access_links_set_updated_at
  BEFORE UPDATE ON public.access_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.access_link_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.access_links(id) ON DELETE CASCADE,
  device_hash text NOT NULL,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, device_hash)
);

GRANT SELECT, DELETE ON public.access_link_devices TO authenticated;
GRANT ALL ON public.access_link_devices TO service_role;

ALTER TABLE public.access_link_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view access link devices"
  ON public.access_link_devices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.access_links l
    WHERE l.id = access_link_devices.link_id
      AND public.can_manage_restaurant(auth.uid(), l.restaurant_id)
  ));

CREATE POLICY "Managers can delete access link devices"
  ON public.access_link_devices FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.access_links l
    WHERE l.id = access_link_devices.link_id
      AND public.can_manage_restaurant(auth.uid(), l.restaurant_id)
  ));

CREATE TRIGGER access_link_devices_set_updated_at
  BEFORE UPDATE ON public.access_link_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_access_links_restaurant ON public.access_links(restaurant_id);
CREATE INDEX idx_access_link_devices_link ON public.access_link_devices(link_id);