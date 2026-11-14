CREATE TABLE public.training_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Livro de Estudos',
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  book_index jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_path text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_books TO authenticated;
GRANT ALL ON public.training_books TO service_role;
ALTER TABLE public.training_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read book" ON public.training_books FOR SELECT TO authenticated USING (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "managers insert book" ON public.training_books FOR INSERT TO authenticated WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "managers update book" ON public.training_books FOR UPDATE TO authenticated USING (public.can_manage_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "managers delete book" ON public.training_books FOR DELETE TO authenticated USING (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE TRIGGER training_books_updated_at BEFORE UPDATE ON public.training_books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
      (_path LIKE 'training-videos/%' OR _path LIKE 'training-books/%')
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE public.can_manage_restaurant(auth.uid(), r.id)
          AND (_path LIKE 'training-videos/' || r.id::text || '/%' OR _path LIKE 'training-books/' || r.id::text || '/%')
      )
    )
    OR (
      _path LIKE 'wines/%'
      AND auth.uid() IS NOT NULL
      AND (
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