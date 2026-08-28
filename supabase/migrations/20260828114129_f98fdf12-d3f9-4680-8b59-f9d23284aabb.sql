DROP POLICY IF EXISTS "rsa restaurant insert" ON public.restaurant_supplier_access;
CREATE POLICY "rsa restaurant insert" ON public.restaurant_supplier_access FOR INSERT TO authenticated
WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "rsa read" ON public.restaurant_supplier_access;
CREATE POLICY "rsa read" ON public.restaurant_supplier_access FOR SELECT TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR supplier_id = public.supplier_id_of(auth.uid()) OR public.is_admin(auth.uid()));