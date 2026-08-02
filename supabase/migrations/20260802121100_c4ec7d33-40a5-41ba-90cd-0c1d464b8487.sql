GRANT SELECT ON public.pairing_knowledge TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pairing_knowledge TO authenticated;
GRANT ALL ON public.pairing_knowledge TO service_role;