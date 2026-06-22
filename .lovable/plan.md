## Projects: trigger is already correct, but the dialog still swallows errors

Good news on the DB side: the `trg_auto_assign_project` trigger on `public.projects` is already `AFTER INSERT`, so the FK-violation bug that hit clients does **not** exist here. The earlier migration also set `created_by DEFAULT auth.uid()` on projects, so creator auto-fill keeps working.

However, the admin Add Project dialog (`src/routes/_authenticated.admin.projects.tsx`, `handleAdd`) has the same silent-failure pattern the clients page had: the insert result isn't inspected, so any future error (RLS, unique constraint, etc.) would close the dialog with no feedback.

### Fix

Mirror the clients page fix in `handleAdd` of the admin projects page:
- Capture `{ error }` from the `supabase.from("projects").insert(...)` call.
- On error: `toast.error(error.message)` and keep the dialog open.
- On success: `toast.success("Project created")`, then reset form + close + refetch.
- Wrap the reset of `adding` in a `finally` so the button can't get stuck spinning.

### Out of scope

- No DB / trigger / RLS changes — the projects trigger is already fine.
- No change to the self-serve `findOrCreateProject` server-fn flow on the dashboard (it already handles errors).
