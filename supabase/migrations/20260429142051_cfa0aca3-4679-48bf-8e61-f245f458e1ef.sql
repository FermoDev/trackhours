-- 1. Fix overpermissive INSERT on clients & projects
DROP POLICY IF EXISTS "Authenticated users can add clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can add projects" ON public.projects;

CREATE POLICY "Admins can add clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can add projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- RLS policy evaluation does not require EXECUTE grants for these functions
-- since they are referenced internally; trigger functions are invoked by
-- triggers, not by direct calls.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_project_creator() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- 3. Restrict managers' visibility into peer compensation by revoking
-- column-level SELECT on hourly_rate from authenticated. Admins access
-- hourly_rate through service-role server functions.
REVOKE SELECT (hourly_rate) ON public.profiles FROM authenticated, anon;