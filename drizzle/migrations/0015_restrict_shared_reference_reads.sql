CREATE OR REPLACE FUNCTION public.has_app_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.restaurants WHERE owner_id = _user_id AND deleted_at IS NULL)
  )
$$;

REVOKE ALL ON FUNCTION public.has_app_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_app_access(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Categories readable by everyone" ON public.product_categories;
CREATE POLICY "Categories readable by app members" ON public.product_categories
  FOR SELECT TO authenticated
  USING (public.has_app_access(auth.uid()));

DROP POLICY IF EXISTS "wineries read" ON public.wineries;
CREATE POLICY "wineries read by app members" ON public.wineries
  FOR SELECT TO authenticated
  USING (public.has_app_access(auth.uid()));