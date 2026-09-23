CREATE TABLE public.global_wine_story_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL UNIQUE REFERENCES public.wine_catalog(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  compact_summary text,
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
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_wine_story_cards TO authenticated;
GRANT ALL ON public.global_wine_story_cards TO service_role;
ALTER TABLE public.global_wine_story_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read published global training cards"
ON public.global_wine_story_cards FOR SELECT TO authenticated
USING (status = 'published' OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage global training cards"
ON public.global_wine_story_cards FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER set_global_wine_story_cards_updated_at
BEFORE UPDATE ON public.global_wine_story_cards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.training_library_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  description text,
  video_url text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order integer NOT NULL DEFAULT 0,
  recommended_for_all boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_library_videos TO authenticated;
GRANT ALL ON public.training_library_videos TO service_role;
ALTER TABLE public.training_library_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read published training library videos"
ON public.training_library_videos FOR SELECT TO authenticated
USING (status = 'published' OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage training library videos"
ON public.training_library_videos FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER set_training_library_videos_updated_at
BEFORE UPDATE ON public.training_library_videos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.restaurant_training_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.training_library_videos(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, video_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_training_videos TO authenticated;
GRANT ALL ON public.restaurant_training_videos TO service_role;
ALTER TABLE public.restaurant_training_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restaurant managers read training video choices"
ON public.restaurant_training_videos FOR SELECT TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Restaurant managers add training video choices"
ON public.restaurant_training_videos FOR INSERT TO authenticated
WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Restaurant managers update training video choices"
ON public.restaurant_training_videos FOR UPDATE TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id))
WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Restaurant managers remove training video choices"
ON public.restaurant_training_videos FOR DELETE TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id));
CREATE TRIGGER set_restaurant_training_videos_updated_at
BEFORE UPDATE ON public.restaurant_training_videos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX global_wine_story_cards_status_idx ON public.global_wine_story_cards(status);
CREATE INDEX training_library_videos_status_sort_idx ON public.training_library_videos(status, sort_order);
CREATE INDEX restaurant_training_videos_restaurant_idx ON public.restaurant_training_videos(restaurant_id);