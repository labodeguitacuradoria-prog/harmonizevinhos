CREATE OR REPLACE FUNCTION public.auto_submit_supplier_to_catalog()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    NEW.notes, 'pending'::catalog_status, auth.uid(), NULL
  ) RETURNING id INTO new_catalog_id;

  NEW.catalog_id := new_catalog_id;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_submit_supplier_to_catalog() FROM anon, authenticated;