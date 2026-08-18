GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.belongs_to_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_id_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_can_see_restaurant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_product_media(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;