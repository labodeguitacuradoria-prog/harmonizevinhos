CREATE POLICY "Backend can manage app user connections"
ON public.app_user_connections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);