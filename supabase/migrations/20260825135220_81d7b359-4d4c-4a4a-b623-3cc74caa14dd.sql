DROP TABLE IF EXISTS public.app_user_connections;

ALTER TABLE public.purchase_orders
  DROP COLUMN IF EXISTS sent_from_email,
  DROP COLUMN IF EXISTS sent_provider_message_id;

CREATE TYPE public.purchase_doc_type AS ENUM ('invoice','boleto','payment_proof','supplier_confirmation','other');

CREATE TABLE public.purchase_order_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  doc_type public.purchase_doc_type NOT NULL DEFAULT 'invoice',
  doc_number text,
  amount numeric,
  due_date date,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_pod_order ON public.purchase_order_documents(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_documents TO authenticated;
GRANT ALL ON public.purchase_order_documents TO service_role;

ALTER TABLE public.purchase_order_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant managers manage order documents"
ON public.purchase_order_documents FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders o
  WHERE o.id = purchase_order_documents.order_id
    AND public.can_manage_restaurant(auth.uid(), o.restaurant_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.purchase_orders o
  WHERE o.id = purchase_order_documents.order_id
    AND public.can_manage_restaurant(auth.uid(), o.restaurant_id)
));

CREATE POLICY "Supplier can view own order documents"
ON public.purchase_order_documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders o
  WHERE o.id = purchase_order_documents.order_id
    AND o.supplier_id = public.supplier_id_of(auth.uid())
));

CREATE TRIGGER trg_pod_updated_at BEFORE UPDATE ON public.purchase_order_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.can_access_order_documents(_path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_orders o
    WHERE _path LIKE o.restaurant_id::text || '/%'
      AND (
        public.can_manage_restaurant(auth.uid(), o.restaurant_id)
        OR o.supplier_id = public.supplier_id_of(auth.uid())
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_order_documents(text) FROM anon;

CREATE POLICY "Order docs read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-documents' AND public.can_access_order_documents(name));

CREATE POLICY "Order docs insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-documents' AND public.can_access_order_documents(name));

CREATE POLICY "Order docs update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'order-documents' AND public.can_access_order_documents(name));

CREATE POLICY "Order docs delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-documents' AND public.can_access_order_documents(name));