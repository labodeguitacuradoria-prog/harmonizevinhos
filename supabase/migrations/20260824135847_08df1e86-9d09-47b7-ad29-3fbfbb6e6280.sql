CREATE TYPE public.purchase_order_status AS ENUM ('draft','sent','partial','received','cancelled');
CREATE TYPE public.purchase_send_channel AS ENUM ('email','whatsapp','manual');

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  status public.purchase_order_status NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  sent_channel public.purchase_send_channel,
  expected_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  wine_id uuid NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  qty_bottles integer NOT NULL DEFAULT 0,
  qty_received integer NOT NULL DEFAULT 0,
  unit_cost numeric,
  item_notes text,
  status text NOT NULL DEFAULT 'pending',
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_restaurant ON public.purchase_orders(restaurant_id);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_poi_order ON public.purchase_order_items(order_id);
CREATE INDEX idx_poi_wine ON public.purchase_order_items(wine_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_manage" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.can_manage_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.can_manage_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "po_staff_read" ON public.purchase_orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.restaurant_id = purchase_orders.restaurant_id
  ));

CREATE POLICY "po_supplier_read" ON public.purchase_orders FOR SELECT TO authenticated
  USING (
    supplier_id = public.supplier_id_of(auth.uid())
    AND public.supplier_can_see_restaurant(supplier_id, restaurant_id)
  );

CREATE POLICY "poi_manage" ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders o
    WHERE o.id = purchase_order_items.order_id
      AND public.can_manage_restaurant(auth.uid(), o.restaurant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_orders o
    WHERE o.id = purchase_order_items.order_id
      AND public.can_manage_restaurant(auth.uid(), o.restaurant_id)
  ));

CREATE POLICY "poi_staff_read" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders o
    JOIN public.user_roles ur ON ur.restaurant_id = o.restaurant_id
    WHERE o.id = purchase_order_items.order_id AND ur.user_id = auth.uid()
  ));

CREATE POLICY "poi_supplier_read" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders o
    WHERE o.id = purchase_order_items.order_id
      AND o.supplier_id = public.supplier_id_of(auth.uid())
      AND public.supplier_can_see_restaurant(o.supplier_id, o.restaurant_id)
  ));

CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_poi_updated_at BEFORE UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.purchase_item_receive_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta integer;
  o record;
  total_pend integer;
  total_recv integer;
BEGIN
  delta := COALESCE(NEW.qty_received,0) - COALESCE(OLD.qty_received,0);

  SELECT * INTO o FROM public.purchase_orders WHERE id = NEW.order_id;

  IF delta > 0 THEN
    INSERT INTO public.inventory_movements (
      wine_id, restaurant_id, movement_type, quantity, unit_price, unit_cost, notes, occurred_at, created_by
    ) VALUES (
      NEW.wine_id, o.restaurant_id, 'entry', delta, NEW.unit_cost, NEW.unit_cost,
      'Recebimento de pedido', COALESCE(NEW.received_at, now()), auth.uid()
    );
  END IF;

  IF COALESCE(NEW.qty_received,0) >= COALESCE(NEW.qty_bottles,0) AND COALESCE(NEW.qty_bottles,0) > 0 THEN
    NEW.status := 'received';
  ELSIF COALESCE(NEW.qty_received,0) > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.status <> 'cancelled' THEN
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_poi_receive BEFORE UPDATE OF qty_received ON public.purchase_order_items
  FOR EACH ROW WHEN (NEW.qty_received IS DISTINCT FROM OLD.qty_received)
  EXECUTE FUNCTION public.purchase_item_receive_sync();

CREATE OR REPLACE FUNCTION public.purchase_order_status_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_total integer;
  n_recv integer;
  n_part integer;
  o_status public.purchase_order_status;
BEGIN
  SELECT count(*) FILTER (WHERE status <> 'cancelled'),
         count(*) FILTER (WHERE status = 'received'),
         count(*) FILTER (WHERE status = 'partial')
    INTO n_total, n_recv, n_part
  FROM public.purchase_order_items WHERE order_id = NEW.order_id;

  SELECT status INTO o_status FROM public.purchase_orders WHERE id = NEW.order_id;

  IF o_status = 'cancelled' OR o_status = 'draft' THEN
    RETURN NULL;
  END IF;

  IF n_total > 0 AND n_recv = n_total THEN
    UPDATE public.purchase_orders SET status = 'received' WHERE id = NEW.order_id;
  ELSIF n_recv > 0 OR n_part > 0 THEN
    UPDATE public.purchase_orders SET status = 'partial' WHERE id = NEW.order_id;
  ELSE
    UPDATE public.purchase_orders SET status = 'sent' WHERE id = NEW.order_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_poi_order_status AFTER UPDATE OF qty_received, status ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.purchase_order_status_sync();