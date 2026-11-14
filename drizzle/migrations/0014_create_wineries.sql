CREATE TABLE public.wineries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_key text NOT NULL UNIQUE,
  about text,
  website text,
  country text,
  region text,
  founded text,
  photos text[] NOT NULL DEFAULT '{}',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wineries TO authenticated;
GRANT ALL ON public.wineries TO service_role;
ALTER TABLE public.wineries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wineries read" ON public.wineries FOR SELECT TO authenticated USING (true);
CREATE POLICY "wineries insert" ON public.wineries FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.restaurants r WHERE public.can_manage_restaurant(auth.uid(), r.id)));
CREATE POLICY "wineries update" ON public.wineries FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.restaurants r WHERE public.can_manage_restaurant(auth.uid(), r.id)));
CREATE TRIGGER wineries_updated BEFORE UPDATE ON public.wineries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();