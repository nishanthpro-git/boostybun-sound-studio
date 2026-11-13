DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;
REVOKE SELECT ON public.rooms FROM anon, authenticated;