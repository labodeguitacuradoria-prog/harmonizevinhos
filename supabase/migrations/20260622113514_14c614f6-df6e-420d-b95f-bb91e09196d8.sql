ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS volume text;
ALTER TABLE public.wines ALTER COLUMN wine_type TYPE text USING wine_type::text;