-- pairing_knowledge: split public vs authenticated read so anon needs no helper functions
DROP POLICY IF EXISTS "pairing_knowledge_read_active" ON public.pairing_knowledge;

CREATE POLICY "pairing_knowledge_public_read_active" ON public.pairing_knowledge
FOR SELECT TO anon
USING (active = true);

CREATE POLICY "pairing_knowledge_auth_read" ON public.pairing_knowledge
FOR SELECT TO authenticated
USING (active = true OR public.is_admin(auth.uid()));

-- Trigger-only functions: not callable through the API at all
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_submit_to_catalog() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_submit_supplier_to_catalog() FROM PUBLIC, anon, authenticated;

-- Helper predicates: signed-in users only (needed by RLS policies)
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.is_admin(uuid)',
    'public.can_manage_restaurant(uuid, uuid)',
    'public.can_view_group(uuid, uuid)',
    'public.belongs_to_group(uuid, uuid)',
    'public.owns_restaurant(uuid, uuid)',
    'public.supplier_can_see_restaurant(uuid, uuid)',
    'public.supplier_id_of(uuid)',
    'public.my_groups(uuid)',
    'public.my_restaurants(uuid)',
    'public.can_access_product_media(text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;