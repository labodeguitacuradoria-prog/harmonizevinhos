-- 1. suppliers: restrict SELECT
DROP POLICY IF EXISTS "all read suppliers" ON public.suppliers;
CREATE POLICY "suppliers scoped read" ON public.suppliers
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.supplier_id_of(auth.uid()) = id
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.restaurant_supplier_access rsa
    WHERE rsa.supplier_id = suppliers.id
      AND rsa.enabled = true
      AND public.can_manage_restaurant(auth.uid(), rsa.restaurant_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.wines w
    WHERE w.supplier_id = suppliers.id
      AND public.can_manage_restaurant(auth.uid(), w.restaurant_id)
  )
);

-- 2. supplier_materials: restrict SELECT
DROP POLICY IF EXISTS "materials read" ON public.supplier_materials;
CREATE POLICY "materials scoped read" ON public.supplier_materials
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.supplier_id_of(auth.uid()) = supplier_id
  OR EXISTS (
    SELECT 1 FROM public.restaurant_supplier_access rsa
    WHERE rsa.supplier_id = supplier_materials.supplier_id
      AND rsa.enabled = true
      AND public.can_manage_restaurant(auth.uid(), rsa.restaurant_id)
  )
);

-- 3. storage: ownership-aware policies for product-media
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
      _path LIKE 'wine-lists/%'
      AND EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE public.can_manage_restaurant(auth.uid(), r.id)
          AND _path LIKE 'wine-lists/' || r.id::text || '/%'
      )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_product_media(text) FROM anon;

DROP POLICY IF EXISTS "Authenticated read product-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload product-media" ON storage.objects;

CREATE POLICY "product-media scoped read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'product-media'
  AND (owner = auth.uid() OR public.can_access_product_media(name))
);

CREATE POLICY "product-media scoped insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-media'
  AND public.can_access_product_media(name)
);

CREATE POLICY "product-media scoped update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-media'
  AND (owner = auth.uid() OR public.is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'product-media'
  AND (owner = auth.uid() OR public.is_admin(auth.uid()))
);

CREATE POLICY "product-media scoped delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-media'
  AND (owner = auth.uid() OR public.is_admin(auth.uid()))
);

-- 4. mutable search_path on remaining functions
ALTER FUNCTION public.ensure_single_current_wine_list() SET search_path = public;
ALTER FUNCTION public.get_last_closed_stock(uuid) SET search_path = public;

-- 5. SECURITY DEFINER functions that must not be callable from the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_submit_to_catalog() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_submit_supplier_to_catalog() FROM anon, authenticated;

-- helper predicates are only needed by signed-in users through RLS
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_restaurant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_group(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.belongs_to_group(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.supplier_can_see_restaurant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.supplier_id_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_groups(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_restaurants(uuid) FROM anon;