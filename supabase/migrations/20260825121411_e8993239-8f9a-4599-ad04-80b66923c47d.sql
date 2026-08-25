-- Explicit admin-only write policies on user_roles.
-- Writes are already blocked by REVOKE (migration 20260818103738) and RLS
-- default-deny, but add explicit policies so the protection is visible and
-- survives any future privilege widening.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can insert roles" ON public.user_roles;
CREATE POLICY "admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins can update roles" ON public.user_roles;
CREATE POLICY "admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins can delete roles" ON public.user_roles;
CREATE POLICY "admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));