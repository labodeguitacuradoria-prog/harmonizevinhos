ALTER TABLE public.restaurants
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_restaurants_deleted_at ON public.restaurants(deleted_at);

CREATE OR REPLACE FUNCTION public.owns_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = _restaurant_id
        AND deleted_at IS NULL
        AND owner_id = _user_id
    )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.restaurants r ON r.id = ur.restaurant_id
      WHERE ur.user_id = _user_id
        AND ur.restaurant_id = _restaurant_id
        AND r.deleted_at IS NULL
        AND ur.role IN ('rest_admin'::public.app_role, 'rest_owner'::public.app_role, 'restaurant'::public.app_role)
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = _restaurant_id
        AND deleted_at IS NULL
        AND owner_id = _user_id
    )
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_group(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.restaurants r
      JOIN public.restaurant_groups g ON g.id = r.group_id
      WHERE r.id = _restaurant_id
        AND r.deleted_at IS NULL
        AND g.owner_id = _user_id
    )
$$;

CREATE OR REPLACE FUNCTION public.can_view_group(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.restaurant_groups WHERE id = _group_id AND owner_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.restaurants r ON r.id = ur.restaurant_id
      WHERE r.group_id = _group_id
        AND r.deleted_at IS NULL
        AND ur.user_id = _user_id
        AND ur.role IN ('rest_admin'::public.app_role, 'rest_owner'::public.app_role)
    )
$$;

CREATE OR REPLACE FUNCTION public.my_restaurants(_user_id uuid)
RETURNS TABLE(restaurant_id uuid, name text, city text, group_id uuid, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH access AS (
    SELECT r.id AS restaurant_id, r.name, r.city, r.group_id,
      CASE WHEN r.owner_id = _user_id THEN 'rest_admin' ELSE NULL END AS role
    FROM public.restaurants r
    WHERE r.owner_id = _user_id AND r.deleted_at IS NULL
    UNION ALL
    SELECT r.id, r.name, r.city, r.group_id, ur.role::text
    FROM public.user_roles ur
    JOIN public.restaurants r ON r.id = ur.restaurant_id
    WHERE ur.user_id = _user_id
      AND ur.restaurant_id IS NOT NULL
      AND r.deleted_at IS NULL
  ), ranked AS (
    SELECT restaurant_id, name, city, group_id, role,
      CASE role
        WHEN 'rest_admin' THEN 1 WHEN 'rest_owner' THEN 2 WHEN 'restaurant' THEN 3
        WHEN 'owner' THEN 4 WHEN 'staff' THEN 5 WHEN 'supplier' THEN 6 ELSE 9
      END AS rnk
    FROM access
  ), best AS (
    SELECT DISTINCT ON (restaurant_id) restaurant_id, name, city, group_id, role
    FROM ranked ORDER BY restaurant_id, rnk
  )
  SELECT restaurant_id, name, city, group_id, role FROM best ORDER BY name
$$;

DROP POLICY IF EXISTS "owner & admin read restaurants" ON public.restaurants;
CREATE POLICY "owner & admin read restaurants" ON public.restaurants
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR (deleted_at IS NULL AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "members read restaurants" ON public.restaurants;
CREATE POLICY "members read restaurants" ON public.restaurants
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid()) OR (
    deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.restaurant_id = restaurants.id
    )
  )
);

DROP POLICY IF EXISTS "Owner can see group restaurants" ON public.restaurants;
CREATE POLICY "Owner can see group restaurants" ON public.restaurants
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid()) OR (
    deleted_at IS NULL AND group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.restaurant_groups g
      WHERE g.id = restaurants.group_id AND g.owner_id = auth.uid()
    )
  )
);

GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_restaurant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.belongs_to_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_restaurants(uuid) TO authenticated;