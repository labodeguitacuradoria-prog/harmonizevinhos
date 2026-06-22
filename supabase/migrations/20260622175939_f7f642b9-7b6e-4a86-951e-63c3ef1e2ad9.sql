
-- 1. Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. Create restaurant_groups table
CREATE TABLE public.restaurant_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_groups TO authenticated;
GRANT ALL ON public.restaurant_groups TO service_role;

ALTER TABLE public.restaurant_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages all groups" ON public.restaurant_groups
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Owner sees own group" ON public.restaurant_groups
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER restaurant_groups_set_updated_at
  BEFORE UPDATE ON public.restaurant_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Add group_id to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN group_id UUID REFERENCES public.restaurant_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_restaurants_group_id ON public.restaurants(group_id);

-- 4. Helper: does user belong to (or own) the group of a restaurant?
CREATE OR REPLACE FUNCTION public.belongs_to_group(_user_id UUID, _restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    JOIN public.restaurant_groups g ON g.id = r.group_id
    WHERE r.id = _restaurant_id AND g.owner_id = _user_id
  )
$$;

-- 5. Extend restaurant SELECT policy: owner of group can also see its restaurants
CREATE POLICY "Owner can see group restaurants" ON public.restaurants
  FOR SELECT TO authenticated
  USING (public.belongs_to_group(auth.uid(), id));
