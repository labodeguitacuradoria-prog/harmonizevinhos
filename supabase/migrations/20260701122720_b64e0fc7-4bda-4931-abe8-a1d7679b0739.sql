
-- Grant admin role to system owner
INSERT INTO public.user_roles (user_id, role)
VALUES ('1068d4cf-dcbb-41b7-b42b-1bdb9a82eee8', 'admin'::public.app_role)
ON CONFLICT (user_id, role, restaurant_id, supplier_id) DO NOTHING;

-- Add multi-supplier text array to restaurant wines
ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS suppliers text[];
