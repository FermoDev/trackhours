CREATE OR REPLACE FUNCTION public.auto_assign_client_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;

    INSERT INTO public.client_assignments (user_id, client_id)
    VALUES (auth.uid(), NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_client ON public.clients;
CREATE TRIGGER trg_auto_assign_client
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_client_creator();

CREATE OR REPLACE FUNCTION public.auto_assign_project_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.project_assignments (user_id, project_id)
    VALUES (auth.uid(), NEW.id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.client_assignments (user_id, client_id)
    VALUES (auth.uid(), NEW.client_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_project ON public.projects;
CREATE TRIGGER trg_auto_assign_project
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_project_creator();