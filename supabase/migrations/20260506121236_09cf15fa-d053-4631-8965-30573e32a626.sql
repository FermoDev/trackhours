-- Backfill all entries to approved
UPDATE public.time_entries SET status = 'approved' WHERE status <> 'approved';

-- Change default to approved
ALTER TABLE public.time_entries ALTER COLUMN status SET DEFAULT 'approved'::entry_status;

-- Relax update policy: allow users to update any of their own entries
DROP POLICY IF EXISTS "Users can update own draft entries" ON public.time_entries;
CREATE POLICY "Users can update own entries"
ON public.time_entries
FOR UPDATE
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Relax delete policy: allow users to delete any of their own entries
DROP POLICY IF EXISTS "Users can delete own draft entries" ON public.time_entries;
CREATE POLICY "Users can delete own entries"
ON public.time_entries
FOR DELETE
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));