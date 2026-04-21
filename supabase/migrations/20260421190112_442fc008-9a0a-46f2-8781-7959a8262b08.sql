-- 1. Add created_by column to projects
ALTER TABLE public.projects ADD COLUMN created_by uuid DEFAULT auth.uid();

-- 2. Update projects SELECT policy to include creator visibility
DROP POLICY "Users can view assigned projects" ON public.projects;
CREATE POLICY "Users can view assigned projects" ON public.projects
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.project_id = projects.id
        AND project_assignments.user_id = auth.uid()
    )
  );

-- 3. Restrict client INSERT to admins only
DROP POLICY "Authenticated users can add clients" ON public.clients;