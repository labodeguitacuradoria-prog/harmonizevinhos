ALTER TABLE public.supplier_access_links ADD COLUMN IF NOT EXISTS token text;
REVOKE SELECT (token) ON public.supplier_access_links FROM anon;