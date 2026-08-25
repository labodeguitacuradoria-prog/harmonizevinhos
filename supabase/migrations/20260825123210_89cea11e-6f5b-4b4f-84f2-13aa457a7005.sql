ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS sent_from_email text,
  ADD COLUMN IF NOT EXISTS sent_provider_message_id text;

CREATE TABLE IF NOT EXISTS public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  connected_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);

GRANT ALL ON public.app_user_connections TO service_role;

ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_app_user_connections_updated_at ON public.app_user_connections;
CREATE TRIGGER update_app_user_connections_updated_at
BEFORE UPDATE ON public.app_user_connections
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();