CREATE TABLE public.custom_menu_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Carta personalizada',
  brief_text text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','in_progress','delivered','cancelled')),
  admin_notes text,
  delivered_list_id uuid REFERENCES public.printed_wine_lists(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_menu_requests TO authenticated;
GRANT ALL ON public.custom_menu_requests TO service_role;
ALTER TABLE public.custom_menu_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr select" ON public.custom_menu_requests FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "cmr insert" ON public.custom_menu_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "cmr update" ON public.custom_menu_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "cmr delete" ON public.custom_menu_requests FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER cmr_updated BEFORE UPDATE ON public.custom_menu_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "cmb read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'custom-menu-briefs' AND (public.is_admin(auth.uid()) OR public.can_manage_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "cmb insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'custom-menu-briefs' AND (public.is_admin(auth.uid()) OR public.can_manage_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)));