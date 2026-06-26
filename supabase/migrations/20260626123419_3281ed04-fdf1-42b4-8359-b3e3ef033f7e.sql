
-- 1. Wines: dois flags de status
ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS active_on_menu boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS count_in_stock boolean NOT NULL DEFAULT true;

-- 2. stock_count_issues: resolução
ALTER TABLE public.stock_count_issues
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Policies de gerenciamento para admin do restaurante (rest_admin / rest_owner)
-- Sessions
DROP POLICY IF EXISTS "Managers manage all stock count sessions" ON public.stock_count_sessions;
CREATE POLICY "Managers manage all stock count sessions"
  ON public.stock_count_sessions
  FOR ALL TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

-- Items
DROP POLICY IF EXISTS "Managers manage all stock count items" ON public.stock_count_items;
CREATE POLICY "Managers manage all stock count items"
  ON public.stock_count_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stock_count_sessions s
    WHERE s.id = stock_count_items.session_id
      AND public.can_manage_restaurant(auth.uid(), s.restaurant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stock_count_sessions s
    WHERE s.id = stock_count_items.session_id
      AND public.can_manage_restaurant(auth.uid(), s.restaurant_id)
  ));

-- Issues: UPDATE para marcar resolvido
DROP POLICY IF EXISTS "issues updatable by restaurant managers" ON public.stock_count_issues;
CREATE POLICY "issues updatable by restaurant managers"
  ON public.stock_count_issues
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stock_count_sessions s
    WHERE s.id = stock_count_issues.session_id
      AND public.can_manage_restaurant(auth.uid(), s.restaurant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stock_count_sessions s
    WHERE s.id = stock_count_issues.session_id
      AND public.can_manage_restaurant(auth.uid(), s.restaurant_id)
  ));

-- 4. Identificar movimentos gerados por uma sessão de contagem (para recalcular ao reabrir)
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS source_session_id uuid REFERENCES public.stock_count_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inv_source_session_idx ON public.inventory_movements(source_session_id);
