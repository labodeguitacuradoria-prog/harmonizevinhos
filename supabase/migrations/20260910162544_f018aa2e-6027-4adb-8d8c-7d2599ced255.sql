
INSERT INTO public.user_roles (user_id, role, restaurant_id)
SELECT r.owner_id, 'rest_admin'::app_role, r.id
FROM public.restaurants r
WHERE r.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = r.owner_id AND ur.restaurant_id = r.id
  );

CREATE OR REPLACE FUNCTION public.ensure_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, restaurant_id)
    VALUES (NEW.owner_id, 'rest_admin'::app_role, NEW.id)
    ON CONFLICT (user_id, role, restaurant_id, supplier_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_owner_role_on_restaurant ON public.restaurants;
CREATE TRIGGER ensure_owner_role_on_restaurant
AFTER INSERT ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_role();
