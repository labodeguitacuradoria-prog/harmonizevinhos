ALTER TABLE public.global_wine_story_cards ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.wine_story_cards ADD COLUMN IF NOT EXISTS image_url text;
COMMENT ON COLUMN public.global_wine_story_cards.image_url IS 'Imagem da garrafa normalizada e persistida para a ficha global de treinamento.';
COMMENT ON COLUMN public.wine_story_cards.image_url IS 'Cópia da imagem normalizada usada pela ficha de treinamento do restaurante.';