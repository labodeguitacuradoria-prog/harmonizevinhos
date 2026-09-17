ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'training';
ALTER TYPE public.access_link_scope ADD VALUE IF NOT EXISTS 'training';

CREATE TABLE public.wine_story_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id uuid NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  grapes_line text,
  making_line text,
  origin_story text,
  name_meaning text,
  mouthfeel text,
  pairings text[] NOT NULL DEFAULT '{}',
  sales_pitch text,
  fun_fact text,
  do_not_confuse text,
  generated_by_ai boolean NOT NULL DEFAULT false,
  model_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wine_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wine_story_cards TO authenticated;
GRANT ALL ON public.wine_story_cards TO service_role;

ALTER TABLE public.wine_story_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers view story cards" ON public.wine_story_cards
  FOR SELECT TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Managers insert story cards" ON public.wine_story_cards
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Managers update story cards" ON public.wine_story_cards
  FOR UPDATE TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Managers delete story cards" ON public.wine_story_cards
  FOR DELETE TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE TRIGGER wine_story_cards_updated_at
  BEFORE UPDATE ON public.wine_story_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.training_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.access_links(id) ON DELETE SET NULL,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  finished_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_quiz_attempts TO authenticated;
GRANT ALL ON public.training_quiz_attempts TO service_role;

ALTER TABLE public.training_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers view quiz attempts" ON public.training_quiz_attempts
  FOR SELECT TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));