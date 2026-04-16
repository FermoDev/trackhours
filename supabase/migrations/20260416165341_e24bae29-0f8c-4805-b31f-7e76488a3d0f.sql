
-- Allow authenticated users to insert clients
CREATE POLICY "Authenticated users can add clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow admins to delete clients
CREATE POLICY "Admins can delete clients"
ON public.clients
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow authenticated users to insert projects
CREATE POLICY "Authenticated users can add projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow admins to delete projects
CREATE POLICY "Admins can delete projects"
ON public.projects
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
