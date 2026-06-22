## Root cause: client-assignment trigger fires BEFORE INSERT

The `trg_auto_assign_client` trigger on `public.clients` runs `BEFORE INSERT` and tries to insert into `client_assignments` using `NEW.id`. But at `BEFORE INSERT` the `clients` row doesn't physically exist yet, so the FK `client_assignments.client_id → clients.id` fails — which is the error toast you just saw.

The matching project trigger almost certainly has the same problem.

### Fix (single migration)

1. Drop and recreate both auto-assign triggers as `AFTER INSERT`:
   - `trg_auto_assign_client` on `public.clients` → AFTER INSERT
   - The equivalent project trigger on `public.projects` → AFTER INSERT
2. Keep the existing trigger functions (`auto_assign_client_creator`, `auto_assign_project_creator`) as-is — they already do the right thing; only the timing is wrong.
3. Note: as `AFTER INSERT` the trigger can no longer mutate `NEW.created_by`. To keep the "default `created_by` to `auth.uid()`" behavior, add it as a column default (`DEFAULT auth.uid()`) on `clients` and `projects`, so the auto-fill still happens for both admin and self-serve inserts.

### Verification

After the migration runs, retry Add Client in `/admin/clients` — it should succeed and the new client should appear, with the creator auto-assigned.

### Out of scope

- No RLS policy changes.
- No application code changes.
