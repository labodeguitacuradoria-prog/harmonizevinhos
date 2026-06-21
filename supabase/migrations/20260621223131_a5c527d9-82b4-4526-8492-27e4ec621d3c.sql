
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'restaurant', 'supplier');
CREATE TYPE public.movement_type AS ENUM ('entry', 'sale', 'adjustment');
CREATE TYPE public.wine_type AS ENUM ('red', 'white', 'rose', 'sparkling', 'dessert', 'fortified');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ RESTAURANTS ============
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, restaurant_id, supplier_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.owns_restaurant(_user_id UUID, _restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = _restaurant_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.supplier_id_of(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT supplier_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'supplier' AND supplier_id IS NOT NULL
  LIMIT 1
$$;

-- ============ RESTAURANT/SUPPLIER ACCESS ============
CREATE TABLE public.restaurant_supplier_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, supplier_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_supplier_access TO authenticated;
GRANT ALL ON public.restaurant_supplier_access TO service_role;

CREATE OR REPLACE FUNCTION public.supplier_can_see_restaurant(_supplier_id UUID, _restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_supplier_access
    WHERE supplier_id = _supplier_id AND restaurant_id = _restaurant_id AND enabled = true
  )
$$;

-- ============ WINES ============
CREATE TABLE public.wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  producer TEXT,
  vintage INT,
  region TEXT,
  country TEXT,
  grape TEXT,
  wine_type public.wine_type,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wines_restaurant_idx ON public.wines(restaurant_id);
CREATE INDEX wines_supplier_idx ON public.wines(supplier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wines TO authenticated;
GRANT ALL ON public.wines TO service_role;

-- ============ INVENTORY MOVEMENTS ============
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id UUID NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  movement_type public.movement_type NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2),
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inv_wine_idx ON public.inventory_movements(wine_id);
CREATE INDEX inv_restaurant_idx ON public.inventory_movements(restaurant_id);
CREATE INDEX inv_occurred_idx ON public.inventory_movements(occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;

-- ============ RLS POLICIES ============

-- restaurants
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner & admin read restaurants" ON public.restaurants FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.restaurant_supplier_access rsa
  WHERE rsa.restaurant_id = restaurants.id AND rsa.enabled = true
    AND rsa.supplier_id = public.supplier_id_of(auth.uid())
));
CREATE POLICY "owner create restaurant" ON public.restaurants FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update restaurant" ON public.restaurants FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "owner delete restaurant" ON public.restaurants FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- suppliers (admin manage; all authenticated can read names)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage suppliers ins" ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin manage suppliers upd" ON public.suppliers FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));
CREATE POLICY "admin manage suppliers del" ON public.suppliers FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- restaurant_supplier_access
ALTER TABLE public.restaurant_supplier_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsa read" ON public.restaurant_supplier_access FOR SELECT TO authenticated
USING (
  public.owns_restaurant(auth.uid(), restaurant_id)
  OR supplier_id = public.supplier_id_of(auth.uid())
  OR public.is_admin(auth.uid())
);
CREATE POLICY "rsa restaurant insert" ON public.restaurant_supplier_access FOR INSERT TO authenticated
WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "rsa restaurant update" ON public.restaurant_supplier_access FOR UPDATE TO authenticated
USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "rsa restaurant delete" ON public.restaurant_supplier_access FOR DELETE TO authenticated
USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- wines
ALTER TABLE public.wines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wines read" ON public.wines FOR SELECT TO authenticated
USING (
  public.owns_restaurant(auth.uid(), restaurant_id)
  OR public.is_admin(auth.uid())
  OR (
    supplier_id = public.supplier_id_of(auth.uid())
    AND public.supplier_can_see_restaurant(public.supplier_id_of(auth.uid()), restaurant_id)
  )
);
CREATE POLICY "wines insert" ON public.wines FOR INSERT TO authenticated
WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "wines update" ON public.wines FOR UPDATE TO authenticated
USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "wines delete" ON public.wines FOR DELETE TO authenticated
USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- inventory_movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv read" ON public.inventory_movements FOR SELECT TO authenticated
USING (
  public.owns_restaurant(auth.uid(), restaurant_id)
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.wines w
    WHERE w.id = inventory_movements.wine_id
      AND w.supplier_id = public.supplier_id_of(auth.uid())
      AND public.supplier_can_see_restaurant(public.supplier_id_of(auth.uid()), inventory_movements.restaurant_id)
  )
);
CREATE POLICY "inv insert" ON public.inventory_movements FOR INSERT TO authenticated
WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "inv update" ON public.inventory_movements FOR UPDATE TO authenticated
USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "inv delete" ON public.inventory_movements FOR DELETE TO authenticated
USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_set_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER restaurants_set_updated BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER suppliers_set_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rsa_set_updated BEFORE UPDATE ON public.restaurant_supplier_access FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER wines_set_updated BEFORE UPDATE ON public.wines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SIGNUP TRIGGER: profile + default 'restaurant' role + new restaurant ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_restaurant_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- default: new sign-up gets a restaurant + restaurant role
  INSERT INTO public.restaurants (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'Meu Restaurante'), NEW.id)
  RETURNING id INTO new_restaurant_id;

  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  VALUES (NEW.id, 'restaurant', new_restaurant_id);

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
