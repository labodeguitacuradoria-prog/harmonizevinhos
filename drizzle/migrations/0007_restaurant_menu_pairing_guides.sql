ALTER TYPE public.access_link_scope ADD VALUE IF NOT EXISTS 'pairings';

CREATE TABLE public.restaurant_menu_pairing_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Harmonizações do cardápio',
  dishes jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_menu_pairing_guides TO authenticated;
GRANT ALL ON public.restaurant_menu_pairing_guides TO service_role;

ALTER TABLE public.restaurant_menu_pairing_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view restaurant menu pairings"
ON public.restaurant_menu_pairing_guides FOR SELECT TO authenticated
USING (
  public.can_manage_restaurant(auth.uid(), restaurant_id)
  OR public.belongs_to_group(auth.uid(), restaurant_id)
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Managers can create restaurant menu pairings"
ON public.restaurant_menu_pairing_guides FOR INSERT TO authenticated
WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Managers can update restaurant menu pairings"
ON public.restaurant_menu_pairing_guides FOR UPDATE TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()))
WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Managers can delete restaurant menu pairings"
ON public.restaurant_menu_pairing_guides FOR DELETE TO authenticated
USING (public.can_manage_restaurant(auth.uid(), restaurant_id) OR public.is_admin(auth.uid()));

CREATE INDEX restaurant_menu_pairing_guides_restaurant_idx
ON public.restaurant_menu_pairing_guides(restaurant_id);

CREATE TRIGGER restaurant_menu_pairing_guides_set_updated_at
BEFORE UPDATE ON public.restaurant_menu_pairing_guides
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();