-- 1. Create client_assignments table
CREATE TABLE public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client assignments"
  ON public.client_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own client assignments"
  ON public.client_assignments FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Update clients SELECT policy to use client_assignments
DROP POLICY "Users can view assigned clients" ON public.clients;
CREATE POLICY "Users can view assigned clients" ON public.clients
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM client_assignments ca
      WHERE ca.client_id = clients.id AND ca.user_id = auth.uid()
    )
  );

-- 3. Update projects SELECT policy to use client_assignments
DROP POLICY "Users can view assigned projects" ON public.projects;
CREATE POLICY "Users can view assigned projects" ON public.projects
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM client_assignments ca
      WHERE ca.client_id = projects.client_id AND ca.user_id = auth.uid()
    )
  );

-- 4. Update auto-assign trigger to also create client_assignment
CREATE OR REPLACE FUNCTION public.auto_assign_project_creator()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.project_assignments (user_id, project_id)
    VALUES (auth.uid(), NEW.id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.client_assignments (user_id, client_id)
    VALUES (auth.uid(), NEW.client_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;