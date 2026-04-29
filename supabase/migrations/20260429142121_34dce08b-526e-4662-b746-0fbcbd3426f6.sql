-- Restore column SELECT for authenticated (admins need it; RLS still gates rows)
GRANT SELECT (hourly_rate) ON public.profiles TO authenticated;

-- Remove the manager direct-read policy on profiles. Managers will use a
-- server function that returns sanitized teammate data.
DROP POLICY IF EXISTS "Managers can view teammate profiles" ON public.profiles;