
-- 1. Auto-assign trigger function
CREATE OR REPLACE FUNCTION public.auto_assign_project_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.project_assignments (user_id, project_id)
    VALUES (auth.uid(), NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_project
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_project_creator();

-- 2. Tighten clients SELECT
DROP POLICY "Authenticated users can view active clients" ON public.clients;
CREATE POLICY "Users can view assigned clients" ON public.clients
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN projects p ON p.id = pa.project_id
      WHERE p.client_id = clients.id AND pa.user_id = auth.uid()
    )
  );

-- 3. Tighten projects SELECT
DROP POLICY "Users can view assigned projects" ON public.projects;
CREATE POLICY "Users can view assigned projects" ON public.projects
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.project_id = projects.id
        AND project_assignments.user_id = auth.uid()
    )
  );

-- 4. Re-create INSERT policies (keep authenticated users able to add, trigger handles assignment)
DROP POLICY IF EXISTS "Authenticated users can add clients" ON public.clients;
CREATE POLICY "Authenticated users can add clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can add projects" ON public.projects;
CREATE POLICY "Authenticated users can add projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (true);
