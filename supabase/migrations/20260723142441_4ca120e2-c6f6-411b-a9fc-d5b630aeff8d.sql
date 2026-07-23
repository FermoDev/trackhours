
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

-- Seed from existing max
DO $$
DECLARE max_num int;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(invoice_number, '\D', '', 'g'))::int), 0)
  INTO max_num FROM public.invoices WHERE invoice_number ~ '\d';
  PERFORM setval('public.invoice_number_seq', GREATEST(max_num, 1), max_num > 0);
END $$;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.invoice_number_seq');
  RETURN 'INV-' || lpad(n::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;
