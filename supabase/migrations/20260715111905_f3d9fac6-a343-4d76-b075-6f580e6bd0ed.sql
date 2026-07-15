
-- Supplier catalog table
CREATE TABLE public.supplier_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trade_name text,
  legal_name text,
  cnpj text,
  state_registration text,
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text,
  address_zip text,
  address_country text DEFAULT 'Brasil',
  phone text,
  whatsapp text,
  contact_email text,
  commercial_email text,
  website text,
  primary_contact_name text,
  primary_contact_role text,
  primary_contact_phone text,
  primary_contact_email text,
  specialties text,
  regions text,
  notes text,
  logo_url text,
  status public.catalog_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supplier_catalog_status_idx ON public.supplier_catalog (status);
CREATE INDEX supplier_catalog_cnpj_idx ON public.supplier_catalog (cnpj);
CREATE INDEX supplier_catalog_name_trgm ON public.supplier_catalog USING gin (name gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_catalog TO authenticated;
GRANT ALL ON public.supplier_catalog TO service_role;

ALTER TABLE public.supplier_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view approved suppliers"
  ON public.supplier_catalog FOR SELECT TO authenticated
  USING (status = 'approved' OR submitted_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can submit"
  ON public.supplier_catalog FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Submitter can edit pending, admin edits all"
  ON public.supplier_catalog FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (submitted_by = auth.uid() AND status = 'pending'))
  WITH CHECK (public.is_admin(auth.uid()) OR (submitted_by = auth.uid() AND status = 'pending'));

CREATE POLICY "Admin can delete"
  ON public.supplier_catalog FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_supplier_catalog_updated_at
  BEFORE UPDATE ON public.supplier_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link local suppliers to catalog
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES public.supplier_catalog(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS suppliers_catalog_id_idx ON public.suppliers (catalog_id);

-- Auto-submit trigger
CREATE OR REPLACE FUNCTION public.auto_submit_supplier_to_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_id uuid;
  new_catalog_id uuid;
BEGIN
  IF NEW.catalog_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.cnpj IS NOT NULL AND length(regexp_replace(NEW.cnpj, '\D', '', 'g')) >= 11 THEN
    SELECT id INTO match_id FROM public.supplier_catalog
    WHERE regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = regexp_replace(NEW.cnpj, '\D', '', 'g')
      AND status = 'approved' LIMIT 1;
  END IF;

  IF match_id IS NULL THEN
    SELECT id INTO match_id FROM public.supplier_catalog
    WHERE lower(name) = lower(NEW.name)
      AND lower(coalesce(address_city,'')) = lower(coalesce(NEW.address_city,''))
      AND status = 'approved'
    LIMIT 1;
  END IF;

  IF match_id IS NOT NULL THEN
    NEW.catalog_id := match_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.supplier_catalog (
    name, trade_name, legal_name, cnpj, state_registration,
    address_street, address_number, address_complement, address_district,
    address_city, address_state, address_zip, address_country,
    phone, whatsapp, contact_email, commercial_email, website,
    primary_contact_name, primary_contact_role, primary_contact_phone, primary_contact_email,
    notes, status, submitted_by, source_restaurant_id
  ) VALUES (
    NEW.name, NEW.trade_name, NEW.legal_name, NEW.cnpj, NEW.state_registration,
    NEW.address_street, NEW.address_number, NEW.address_complement, NEW.address_district,
    NEW.address_city, NEW.address_state, NEW.address_zip, NEW.address_country,
    NEW.phone, NEW.whatsapp, NEW.contact_email, NEW.commercial_email, NEW.website,
    NEW.primary_contact_name, NEW.primary_contact_role, NEW.primary_contact_phone, NEW.primary_contact_email,
    NEW.notes, 'pending'::catalog_status, auth.uid(), NEW.restaurant_id
  ) RETURNING id INTO new_catalog_id;

  NEW.catalog_id := new_catalog_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_submit_supplier_to_catalog_trg ON public.suppliers;
CREATE TRIGGER auto_submit_supplier_to_catalog_trg
  BEFORE INSERT ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.auto_submit_supplier_to_catalog();
