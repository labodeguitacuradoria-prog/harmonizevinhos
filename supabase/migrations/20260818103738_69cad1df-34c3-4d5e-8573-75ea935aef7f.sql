-- Lock down user_roles writes: only service_role (server admin) may modify role assignments
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Explicit deny-by-default: no INSERT/UPDATE/DELETE policies exist for user_roles.
-- Ensure RLS is on.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Restrict SECURITY DEFINER helper functions that are only used inside RLS policies
REVOKE EXECUTE ON FUNCTION public.belongs_to_group(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_product_media(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_group(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.supplier_can_see_restaurant(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.supplier_id_of(uuid) FROM anon, authenticated;
