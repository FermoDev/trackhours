DROP TRIGGER IF EXISTS trg_auto_assign_client ON public.clients;

ALTER TABLE public.clients ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.projects ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE TRIGGER trg_auto_assign_client
AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_client_creator();