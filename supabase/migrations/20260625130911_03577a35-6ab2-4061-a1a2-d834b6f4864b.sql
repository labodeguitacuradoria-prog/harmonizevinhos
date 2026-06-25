
-- 1. New roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rest_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rest_owner';
