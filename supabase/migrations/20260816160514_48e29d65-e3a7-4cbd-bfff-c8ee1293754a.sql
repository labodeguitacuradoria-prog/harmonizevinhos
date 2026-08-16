
ALTER POLICY "Admins manage all glasses" ON public.glasses TO authenticated;
ALTER POLICY "Owner views group glasses" ON public.glasses TO authenticated;
ALTER POLICY "Restaurant manages own glasses" ON public.glasses TO authenticated;

ALTER POLICY "Admins manage all stock count items" ON public.stock_count_items TO authenticated;
ALTER POLICY "Restaurant manages own stock count items" ON public.stock_count_items TO authenticated;
ALTER POLICY "Admins manage all stock count sessions" ON public.stock_count_sessions TO authenticated;
ALTER POLICY "Restaurant manages own stock count sessions" ON public.stock_count_sessions TO authenticated;

ALTER POLICY "members read restaurants" ON public.restaurants TO authenticated;

ALTER POLICY "Categories readable by everyone" ON public.product_categories TO authenticated;
REVOKE SELECT ON public.product_categories FROM anon;

DROP POLICY IF EXISTS "pairing_knowledge_public_read_active" ON public.pairing_knowledge;
REVOKE SELECT ON public.pairing_knowledge FROM anon;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
