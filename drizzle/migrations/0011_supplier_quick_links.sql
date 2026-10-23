CREATE TABLE public.supplier_access_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
 revoked_at timestamptz,
 last_access_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_access_links TO authenticated;
GRANT ALL ON public.supplier_access_links TO service_role;
ALTER TABLE public.supplier_access_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_links_manager ON public.supplier_access_links FOR ALL TO authenticated USING (public.can_manage_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE INDEX supplier_links_scope ON public.supplier_access_links(restaurant_id, supplier_id);