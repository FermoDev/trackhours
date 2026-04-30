## Revised approach: self-serve without exposing the company client list

You're right — freelancers shouldn't see the full company client roster. The fix is to let users create or pick clients they already have a relationship with, but never browse other people's clients. Reporting still aggregates correctly because clients/projects remain shared entities under the hood.

## Visibility rules (the key change)

A freelancer can only see a client if **at least one** of these is true:
1. They were assigned to it by an admin (existing `client_assignments` row).
2. They created it themselves (`clients.created_by = auth.uid()` — new column).
3. They have logged time against it (`EXISTS time_entries WHERE user_id = auth.uid() AND client_id = clients.id`).

Same idea for projects. So a freelancer's dropdown shows only their own working set — never the wider company list.

Admins and managers keep their existing broader visibility.

## How self-serve still works without leaking the list

When a freelancer wants to log time for a client:
- The dropdown shows their own clients (from rule 1/2/3 above).
- A **"+ Add client"** action opens a small input where they type the client name.
- On submit, a **server function** (`findOrCreateClient`) runs with the admin client and:
  - Looks up `lower(name) = lower(input)` across all clients.
  - If a match exists → it returns that existing client's id and inserts a `client_assignments` row tying this user to it. The user can now use it. The freelancer never sees a list of other clients — they only get back the one they typed.
  - If no match → inserts a new client with `created_by = auth.uid()` and returns the new id.
- Same flow for projects (`findOrCreateProject` scoped to a client).

This means: two freelancers independently typing "Acme" end up tied to the same `client_id`, so admin reports keep aggregating correctly. But neither freelancer ever sees the other's clients in a list.

The lookup is intentionally name-based — to a freelancer, this looks like "I typed Acme and now it works". They can't enumerate other clients because the only way to discover one is to type its exact name, which they'd only know if they were already working on it.

## What changes

### 1. Add `created_by` to `clients`
`clients` already has it implicit via assignments, but we need an explicit column for the visibility rule and for showing "your clients" in the admin view.

```sql
ALTER TABLE public.clients ADD COLUMN created_by uuid DEFAULT auth.uid();
```

### 2. Tighten RLS to per-user visibility
```sql
DROP POLICY "Users can view assigned clients" ON public.clients;
CREATE POLICY "Users can view their clients"
  ON public.clients FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM client_assignments ca
               WHERE ca.client_id = clients.id AND ca.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM time_entries te
               WHERE te.client_id = clients.id AND te.user_id = auth.uid())
  );
```

Same shape for `projects` (already mostly there — keeps `created_by = auth.uid()` and `client_assignments` checks; we don't widen it).

### 3. Block direct INSERT from freelancers; route through a server function
Direct `INSERT` from the browser would let a freelancer create a client and immediately see it, but it wouldn't run the dedup logic. Worse, if we allowed direct SELECT-by-name they could probe for client existence by trying to insert and seeing the unique-constraint error.

So we keep `INSERT` admin-only on `clients` and `projects`, and add server functions:

- `findOrCreateClient({ name })` — admin-protected server fn (uses `requireSupabaseAuth` to know who's calling, then `supabaseAdmin` to perform the lookup/insert):
  - `select id from clients where lower(name) = lower($1) limit 1`
  - If found: insert into `client_assignments (user_id, client_id)` (on conflict do nothing) and return `{ id, created: false }`.
  - If not found: insert client with `created_by = caller`, return `{ id, created: true }` (no assignment row needed — the `created_by` rule covers them).
- `findOrCreateProject({ clientId, name })` — same idea, scoped to a client. The caller must already be allowed to see `clientId` (we check via the user-scoped supabase client first; if RLS blocks the SELECT, we reject — prevents probing project names under clients you don't have access to).

Both functions return the minimum data: just the id and a `created` flag. No list, no other names.

### 4. Case-insensitive unique indexes (data quality)
```sql
CREATE UNIQUE INDEX clients_name_ci_unique ON clients (lower(name));
CREATE UNIQUE INDEX projects_client_name_ci_unique ON projects (client_id, lower(name));
```

These guarantee "Acme", "acme", and "ACME" all collapse to one row, so per-client totals stay clean. The server function handles the dedup gracefully so users never see a constraint error.

### 5. Frontend changes
- `src/routes/_authenticated.dashboard.tsx`:
  - Client dropdown now shows only the user's visible clients (RLS handles this automatically — no query change).
  - Add **"+ New client"** at the bottom of the client `<Select>`. Clicking it opens a small input. On submit → call `findOrCreateClient` → re-fetch clients → set as selected. Toast: *"Joined existing client"* if `created === false`, *"Client created"* if `true`.
  - Same pattern for the existing "+ Add project" affordance — switch its direct `insert` to `findOrCreateProject` so naming collisions under the same client also dedup.
- `src/routes/_authenticated.timesheet.tsx` filters: same — only shows the user's visible clients/projects (already correct via RLS).

### 6. Admin merge tools (cleanup safety net)
Even with case-insensitive uniqueness, near-duplicates ("Acme" vs "Acme Corp") will still exist. Add admin-only merge:
- `/admin/clients` → "Merge into…" action per row → server fn `mergeClients(sourceId, targetId)` that re-points `time_entries`, `projects`, `client_assignments` from source → target, then deletes source.
- `/admin/projects` → same shape.
- Admins can also reassign `created_by` if a freelancer leaves.

### 7. Manager visibility — unchanged
Managers still see team entries only on assigned clients (existing `time_entries` policy). No change.

## Privacy properties this gives you

- Freelancer A creates "Acme" → only A sees it.
- Freelancer B types "Acme" → server function finds it, silently assigns B → now B sees it. **B cannot see Acme until they explicitly type the name.**
- Freelancer C, who never types "Acme" and was never assigned, can't see Acme exists, can't see who works on it, can't see its projects.
- Admin sees everything; reports across all of Acme's time roll up correctly because everyone is logging against the same `client_id`.

The only residual leak: if freelancer B already knows the client name (e.g. learned it offline), they can join it by typing it. That seems aligned with how this would work in real life — they wouldn't be typing it without prior knowledge.

If you want a stricter model where even typing the name doesn't let them join (admin must approve every match), say so and we can add a "request access" flow instead of auto-assign on match.

## Reporting impact — none

Reports still group by `client_id` / `project_id`. Total hours on Acme = sum across all users who logged against that one shared row. Per-user-per-client breakdown still works. Admin reports unchanged.

## Technical details

**Migration**:
```sql
-- created_by tracking
ALTER TABLE public.clients ADD COLUMN created_by uuid DEFAULT auth.uid();
UPDATE public.clients SET created_by = NULL WHERE created_by = '00000000-0000-0000-0000-000000000000';

-- Tighten clients SELECT to per-user visibility
DROP POLICY "Users can view assigned clients" ON public.clients;
CREATE POLICY "Users can view their clients"
  ON public.clients FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM client_assignments ca
               WHERE ca.client_id = clients.id AND ca.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM time_entries te
               WHERE te.client_id = clients.id AND te.user_id = auth.uid())
  );

-- Keep INSERT admin-only (server functions use admin client)
-- existing "Admins can add clients" / "Admins can add projects" stay as-is

-- Dedup guardrails
CREATE UNIQUE INDEX clients_name_ci_unique ON public.clients (lower(name));
CREATE UNIQUE INDEX projects_client_name_ci_unique ON public.projects (client_id, lower(name));
```

**New server functions** in `src/server/clients.functions.ts`:
- `findOrCreateClient({ name })` → `requireSupabaseAuth` middleware. Trim+validate name (1–100 chars). Lookup via `supabaseAdmin`. If found, upsert `client_assignments(user_id=caller, client_id=found)`. If not, insert client with `created_by = caller`. Return `{ id, created }`.
- `findOrCreateProject({ clientId, name })` → first verify caller can see `clientId` using the user-scoped client (`context.supabase.from("clients").select("id").eq("id", clientId).maybeSingle()`); reject if null. Then admin lookup/insert.
- `mergeClients({ sourceId, targetId })` and `mergeProjects({ sourceId, targetId })` → admin-only, transactional re-point + delete.

All four use proper input validation (Zod) and explicit error returns.

**Frontend**:
- Dashboard client dropdown gets a sticky "+ New client" footer item that opens a small inline input.
- Existing project "+" button switches from direct insert to `findOrCreateProject`.
- Toast feedback distinguishes "joined existing" vs "created".
- Admin clients/projects pages get a "Merge" action.

**Security memory update**: document that freelancer client visibility is gated by created_by / assignments / time_entries, that name-based join is intentional (functional necessity for self-serve dedup), and that direct INSERT to clients/projects is admin-only specifically to force the dedup path.

## Open question

**Strict mode toggle**: do you want me to also add an admin setting "Require admin approval to join an existing client"? That would change the find-or-create flow so that on a name match, instead of auto-assigning, it creates a pending request the admin approves. Default off (auto-join), but available if you want maximum control. Not in this plan unless you ask for it.
