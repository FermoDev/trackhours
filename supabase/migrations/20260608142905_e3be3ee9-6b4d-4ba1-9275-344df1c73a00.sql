
UPDATE public.user_roles SET role = 'freelancer' WHERE role::text = 'manager';

-- Drop manager-only policy outright
DROP POLICY IF EXISTS "Managers can view team entries on assigned clients" ON public.time_entries;

-- Cascade drop has_role + dependent policies, then recreate
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('admin', 'freelancer');

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role
  USING role::text::public.app_role;

DROP TYPE public.app_role_old;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Recreate all policies
CREATE POLICY "Users can view own logs" ON public.activity_logs
  FOR SELECT USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage client assignments" ON public.client_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can add clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete clients" ON public.clients
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access to clients" ON public.clients
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creators can delete own clients" ON public.clients
  FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their clients" ON public.clients
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR (created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.client_assignments ca WHERE ca.client_id = clients.id AND ca.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.time_entries te WHERE te.client_id = clients.id AND te.user_id = auth.uid())
  );

CREATE POLICY "Admins view all invoice items" ON public.invoice_line_items
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all invoices" ON public.invoices
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage assignments" ON public.project_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can add projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access to projects" ON public.projects
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creators can delete own projects" ON public.projects
  FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view assigned projects" ON public.projects
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR (created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.client_assignments ca WHERE ca.client_id = projects.client_id AND ca.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own entries" ON public.time_entries
  FOR DELETE USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own entries" ON public.time_entries
  FOR UPDATE USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own entries" ON public.time_entries
  FOR SELECT USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));
