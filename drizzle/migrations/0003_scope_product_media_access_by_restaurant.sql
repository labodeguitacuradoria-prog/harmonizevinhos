CREATE OR REPLACE FUNCTION public.can_access_product_media(_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin(auth.uid())
    OR _path LIKE 'catalog/%'
    OR (
      _path LIKE 'training-videos/%'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE public.can_manage_restaurant(auth.uid(), r.id)
          AND _path LIKE 'training-videos/' || r.id::text || '/%'
      )
    )
    OR (
      _path LIKE 'wines/%'
      AND auth.uid() IS NOT NULL
      AND (
        -- caminhos legados sem id do restaurante
        _path !~ '^wines/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        OR EXISTS (
          SELECT 1 FROM public.restaurants r
          WHERE public.can_manage_restaurant(auth.uid(), r.id)
            AND _path LIKE 'wines/' || r.id::text || '/%'
        )
      )
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
$function$;