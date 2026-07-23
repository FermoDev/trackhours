
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bank_account_title text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS swift_code text;

DROP POLICY IF EXISTS "Admins view all invoices" ON public.invoices;
CREATE POLICY "Admins manage all invoices" ON public.invoices
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view all invoice items" ON public.invoice_line_items;
CREATE POLICY "Admins manage all invoice items" ON public.invoice_line_items
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update all entries" ON public.time_entries;
CREATE POLICY "Admins update all entries" ON public.time_entries
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
