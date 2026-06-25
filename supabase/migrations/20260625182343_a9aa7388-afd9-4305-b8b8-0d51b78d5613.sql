
ALTER TABLE public.stock_count_items
  ADD COLUMN IF NOT EXISTS flag text,
  ADD COLUMN IF NOT EXISTS flag_note text;

CREATE TABLE IF NOT EXISTS public.stock_count_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
  description text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_count_issues TO authenticated;
GRANT ALL ON public.stock_count_issues TO service_role;

ALTER TABLE public.stock_count_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issues readable by restaurant managers"
  ON public.stock_count_issues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_count_sessions s
      WHERE s.id = stock_count_issues.session_id
        AND public.can_manage_restaurant(auth.uid(), s.restaurant_id)
    )
  );

CREATE POLICY "issues writable by restaurant managers"
  ON public.stock_count_issues FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_count_sessions s
      WHERE s.id = stock_count_issues.session_id
        AND public.can_manage_restaurant(auth.uid(), s.restaurant_id)
    )
  );

CREATE POLICY "issues deletable by restaurant managers"
  ON public.stock_count_issues FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_count_sessions s
      WHERE s.id = stock_count_issues.session_id
        AND public.can_manage_restaurant(auth.uid(), s.restaurant_id)
    )
  );
