CREATE TABLE public.client_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  hourly_rate_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_rates TO authenticated;
GRANT ALL ON public.client_rates TO service_role;

ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client rates"
ON public.client_rates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER client_rates_updated_at
BEFORE UPDATE ON public.client_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();