REVOKE EXECUTE ON FUNCTION public.auto_assign_client_creator() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_project_creator() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;