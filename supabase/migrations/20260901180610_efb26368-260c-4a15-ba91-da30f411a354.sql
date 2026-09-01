-- Restrict supplier updates to relationships that actually exist:
-- a restaurant-side user can only edit a supplier linked (enabled) to
-- one of their restaurants. Admins and the supplier itself keep access.
DROP POLICY IF EXISTS "manage suppliers upd" ON public.suppliers;
CREATE POLICY "manage suppliers upd" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.supplier_id_of(auth.uid()) = suppliers.id
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.restaurant_supplier_access rsa
        ON rsa.restaurant_id = ur.restaurant_id
       AND rsa.enabled = true
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('rest_admin'::app_role, 'rest_owner'::app_role, 'restaurant'::app_role)
        AND rsa.supplier_id = suppliers.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.restaurants r
      JOIN public.restaurant_supplier_access rsa
        ON rsa.restaurant_id = r.id
       AND rsa.enabled = true
      WHERE r.owner_id = auth.uid()
        AND rsa.supplier_id = suppliers.id
    )
  );