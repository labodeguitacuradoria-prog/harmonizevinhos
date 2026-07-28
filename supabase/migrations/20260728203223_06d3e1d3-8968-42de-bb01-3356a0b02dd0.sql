
-- Índices para consultas de acesso
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_restaurant ON public.user_roles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_group ON public.restaurants(group_id);

-- Política adicional: usuário lê restaurantes onde tem papel via user_roles
DROP POLICY IF EXISTS "members read restaurants" ON public.restaurants;
CREATE POLICY "members read restaurants" ON public.restaurants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.restaurant_id = restaurants.id
  )
);

-- can_view_group: admin global, dono do grupo, ou rest_admin/rest_owner em alguma unidade
CREATE OR REPLACE FUNCTION public.can_view_group(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.restaurant_groups WHERE id = _group_id AND owner_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.restaurants r ON r.id = ur.restaurant_id
      WHERE r.group_id = _group_id
        AND ur.user_id = _user_id
        AND ur.role IN ('rest_admin'::public.app_role, 'rest_owner'::public.app_role)
    )
$$;

-- Política adicional em restaurant_groups
DROP POLICY IF EXISTS "members read groups" ON public.restaurant_groups;
CREATE POLICY "members read groups" ON public.restaurant_groups
FOR SELECT
USING (public.can_view_group(auth.uid(), id));

-- my_restaurants: retorna todos os restaurantes acessíveis ao usuário com o "melhor" papel
CREATE OR REPLACE FUNCTION public.my_restaurants(_user_id uuid)
RETURNS TABLE(restaurant_id uuid, name text, city text, group_id uuid, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH access AS (
    SELECT r.id AS restaurant_id, r.name, r.city, r.group_id,
      CASE
        WHEN r.owner_id = _user_id THEN 'rest_admin'
        ELSE NULL
      END AS role
    FROM public.restaurants r
    WHERE r.owner_id = _user_id
    UNION ALL
    SELECT r.id, r.name, r.city, r.group_id, ur.role::text
    FROM public.user_roles ur
    JOIN public.restaurants r ON r.id = ur.restaurant_id
    WHERE ur.user_id = _user_id AND ur.restaurant_id IS NOT NULL
  ),
  ranked AS (
    SELECT restaurant_id, name, city, group_id, role,
      CASE role
        WHEN 'rest_admin' THEN 1
        WHEN 'rest_owner' THEN 2
        WHEN 'restaurant' THEN 3
        WHEN 'owner' THEN 4
        WHEN 'staff' THEN 5
        WHEN 'supplier' THEN 6
        ELSE 9
      END AS rnk
    FROM access
  ),
  best AS (
    SELECT DISTINCT ON (restaurant_id) restaurant_id, name, city, group_id, role
    FROM ranked
    ORDER BY restaurant_id, rnk
  )
  SELECT * FROM best ORDER BY name
$$;

-- my_groups: redes visíveis ao usuário (dono ou rest_admin/rest_owner em alguma unidade)
CREATE OR REPLACE FUNCTION public.my_groups(_user_id uuid)
RETURNS TABLE(group_id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT g.id AS group_id, g.name
  FROM public.restaurant_groups g
  WHERE g.owner_id = _user_id
     OR EXISTS (
       SELECT 1
       FROM public.user_roles ur
       JOIN public.restaurants r ON r.id = ur.restaurant_id
       WHERE r.group_id = g.id
         AND ur.user_id = _user_id
         AND ur.role IN ('rest_admin'::public.app_role, 'rest_owner'::public.app_role)
     )
  ORDER BY name
$$;

GRANT EXECUTE ON FUNCTION public.can_view_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_restaurants(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_groups(uuid) TO authenticated;
