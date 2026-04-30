-- 1. Add created_by tracking to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2. Tighten clients SELECT policy to per-user visibility
DROP POLICY IF EXISTS "Users can view assigned clients" ON public.clients;

CREATE POLICY "Users can view their clients"
  ON public.clients FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.client_assignments ca
      WHERE ca.client_id = clients.id AND ca.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.client_id = clients.id AND te.user_id = auth.uid()
    )
  );

-- 3. Case-insensitive uniqueness to prevent fragmentation
CREATE UNIQUE INDEX IF NOT EXISTS clients_name_ci_unique
  ON public.clients (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS projects_client_name_ci_unique
  ON public.projects (client_id, lower(name));
