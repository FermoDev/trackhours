CREATE POLICY "Managers can view team entries on assigned clients"
ON public.time_entries FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.client_assignments ca
    WHERE ca.user_id = auth.uid()
      AND ca.client_id = time_entries.client_id
  )
);

CREATE POLICY "Managers can view teammate profiles"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.client_assignments mine
    JOIN public.client_assignments theirs ON theirs.client_id = mine.client_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = profiles.user_id
  )
);