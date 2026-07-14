
-- Expand suppliers with full institutional fields
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS commercial_email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_role text,
  ADD COLUMN IF NOT EXISTS primary_contact_phone text,
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS delivery_lead_time text,
  ADD COLUMN IF NOT EXISTS minimum_order text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Allow restaurant admins/owners to create suppliers
DROP POLICY IF EXISTS "restaurants can create suppliers" ON public.suppliers;
CREATE POLICY "restaurants can create suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('rest_admin'::app_role, 'rest_owner'::app_role, 'restaurant'::app_role)
    )
  );

-- Allow restaurant admins/owners and the supplier itself to update suppliers
DROP POLICY IF EXISTS "admin manage suppliers upd" ON public.suppliers;
CREATE POLICY "manage suppliers upd" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid())
    OR supplier_id_of(auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('rest_admin'::app_role, 'rest_owner'::app_role, 'restaurant'::app_role)
    )
  );

-- Supplier materials table
CREATE TABLE IF NOT EXISTS public.supplier_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  material_type text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text,
  file_url text,
  valid_until date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_materials TO authenticated;
GRANT ALL ON public.supplier_materials TO service_role;

ALTER TABLE public.supplier_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials read" ON public.supplier_materials
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "materials supplier insert" ON public.supplier_materials
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin(auth.uid()) OR supplier_id_of(auth.uid()) = supplier_id
  );

CREATE POLICY "materials supplier update" ON public.supplier_materials
  FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid()) OR supplier_id_of(auth.uid()) = supplier_id
  );

CREATE POLICY "materials supplier delete" ON public.supplier_materials
  FOR DELETE TO authenticated
  USING (
    is_admin(auth.uid()) OR supplier_id_of(auth.uid()) = supplier_id
  );

CREATE TRIGGER supplier_materials_set_updated
  BEFORE UPDATE ON public.supplier_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_supplier_materials_supplier ON public.supplier_materials(supplier_id);
