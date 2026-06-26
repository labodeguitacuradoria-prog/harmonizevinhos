
-- 1. Update restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS legal_name text,
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS address_street text,
ADD COLUMN IF NOT EXISTS address_number text,
ADD COLUMN IF NOT EXISTS address_complement text,
ADD COLUMN IF NOT EXISTS address_neighborhood text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_zip_code text,
ADD COLUMN IF NOT EXISTS delivery_instructions text,
ADD COLUMN IF NOT EXISTS business_hours text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS instagram text;

-- 2. Create restaurant_contacts table
CREATE TABLE IF NOT EXISTS public.restaurant_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name text NOT NULL,
    role text, 
    email text,
    phone text,
    whatsapp text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTs for restaurant_contacts
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_contacts TO authenticated;
GRANT ALL ON public.restaurant_contacts TO service_role;

-- Enable RLS for restaurant_contacts
ALTER TABLE public.restaurant_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can manage contacts" ON public.restaurant_contacts
    FOR ALL TO authenticated
    USING (public.owns_restaurant(auth.uid(), restaurant_id))
    WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Suppliers can view contacts" ON public.restaurant_contacts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_supplier_access rsa
        WHERE rsa.restaurant_id = restaurant_contacts.restaurant_id
        AND rsa.supplier_id = public.supplier_id_of(auth.uid())
        AND rsa.enabled = true
    ));

-- 3. Create restaurant_wine_lists table
CREATE TABLE IF NOT EXISTS public.restaurant_wine_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    version_label text,
    is_current boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTs for restaurant_wine_lists
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_wine_lists TO authenticated;
GRANT ALL ON public.restaurant_wine_lists TO service_role;

-- Trigger to ensure only one is_current=true per restaurant
CREATE OR REPLACE FUNCTION public.ensure_single_current_wine_list()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current THEN
        UPDATE public.restaurant_wine_lists SET is_current = false
        WHERE restaurant_id = NEW.restaurant_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.ensure_single_current_wine_list() TO authenticated, service_role;

CREATE TRIGGER trg_ensure_single_current_wine_list
BEFORE INSERT OR UPDATE OF is_current ON public.restaurant_wine_lists
FOR EACH ROW WHEN (NEW.is_current = true)
EXECUTE FUNCTION public.ensure_single_current_wine_list();

-- Enable RLS for restaurant_wine_lists
ALTER TABLE public.restaurant_wine_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can manage wine lists" ON public.restaurant_wine_lists
    FOR ALL TO authenticated
    USING (public.owns_restaurant(auth.uid(), restaurant_id))
    WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Suppliers can view current wine list" ON public.restaurant_wine_lists
    FOR SELECT TO authenticated
    USING (
        is_current = true AND
        EXISTS (
            SELECT 1 FROM public.restaurant_supplier_access rsa
            WHERE rsa.restaurant_id = restaurant_wine_lists.restaurant_id
            AND rsa.supplier_id = public.supplier_id_of(auth.uid())
            AND rsa.enabled = true
        )
    );

-- 4. Function to get last closed stock for "Expected" logic
CREATE OR REPLACE FUNCTION public.get_last_closed_stock(p_restaurant_id uuid)
RETURNS TABLE (wine_id uuid, last_qty integer) AS $$
BEGIN
    RETURN QUERY
    WITH last_sessions AS (
        SELECT s.id, s.reference_date
        FROM public.stock_count_sessions s
        WHERE s.restaurant_id = p_restaurant_id
          AND s.status = 'closed'
        ORDER BY s.reference_date DESC
        LIMIT 1
    )
    SELECT i.wine_id, i.counted_qty
    FROM public.stock_count_items i
    JOIN last_sessions ls ON i.session_id = ls.id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_last_closed_stock(uuid) TO authenticated, service_role;
