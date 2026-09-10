CREATE OR REPLACE FUNCTION public.grant_full_module_on_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.module_entitlements (restaurant_id, module, enabled, source, notes)
  VALUES (
    NEW.id,
    'printed_menu'::public.app_module,
    true,
    'trial'::public.entitlement_source,
    'Pacote inicial seguro; substituído pela escolha feita no cadastro'
  )
  ON CONFLICT (restaurant_id, module) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = NEW.owner_id
      AND restaurant_id = NEW.id
      AND role = 'rest_admin'::public.app_role
      AND supplier_id IS NULL
  ) THEN
    INSERT INTO public.user_roles (user_id, role, restaurant_id, supplier_id)
    VALUES (NEW.owner_id, 'rest_admin'::public.app_role, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_restaurant_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  INSERT INTO public.restaurants (name, owner_id)
  VALUES ('Meu Restaurante', NEW.id)
  RETURNING id INTO new_restaurant_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_full_module_on_restaurant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_owner_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;