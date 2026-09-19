CREATE OR REPLACE FUNCTION public.can_access_product_media(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR _path LIKE 'catalog/%'
    OR (
      _path LIKE 'wines/%'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE public.can_manage_restaurant(auth.uid(), r.id)
      )
    )
    OR (
      _path LIKE 'training-videos/%'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE public.can_manage_restaurant(auth.uid(), r.id)
      )
    )
    OR (
      _path LIKE 'wine-lists/%'
      AND EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE public.can_manage_restaurant(auth.uid(), r.id)
          AND _path LIKE 'wine-lists/' || r.id::text || '/%'
      )
    )
$$;