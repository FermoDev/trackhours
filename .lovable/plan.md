## Wire up the Manager role

Right now `manager` exists in the enum but does nothing. Let's make it real: a manager is assigned to one or more **clients**, and for those clients they can see the time entries and stats of every freelancer also assigned to that client.

### Concept

```text
Client: Orthodent
  ├── Freelancer: Rafay   (client_assignments)
  ├── Freelancer: Saad    (client_assignments)
  └── Manager:   Alizar   (client_assignments + role=manager)
                  └── sees Rafay's & Saad's time on Orthodent
```

A manager is just a user with `role = 'manager'` who has been assigned to one or more clients via the existing `client_assignments` table. No new assignment table needed — same mechanism admins already use to assign freelancers to clients.

### Permissions matrix

| Capability | Admin | Manager | Freelancer |
|---|---|---|---|
| Track own time | yes | yes | yes |
| See own clients/projects | all | assigned | assigned |
| Add projects under assigned clients | yes | yes | yes |
| **See team time entries on their clients** | all | yes (their clients only) | no |
| **Manager Dashboard (team overview)** | — | yes | no |
| Manage users / clients / global reports | yes | no | no |

### Database changes

**1. Update RLS on `time_entries`** — add a manager-can-read policy:

```sql
CREATE POLICY "Managers can view team entries on assigned clients"
ON public.time_entries FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM client_assignments ca
    WHERE ca.user_id = auth.uid()
      AND ca.client_id = time_entries.client_id
  )
);
```

**2. Update RLS on `profiles`** — managers need to see names/emails of teammates on their clients (otherwise the team list shows blank names):

```sql
CREATE POLICY "Managers can view profiles of teammates on shared clients"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM client_assignments mine
    JOIN client_assignments theirs ON theirs.client_id = mine.client_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = profiles.user_id
  )
);
```

(Existing policies for clients/projects already work — managers assigned to a client will see that client and its projects via the current `client_assignments`-based policies.)

### New page: Manager Dashboard

**Route:** `src/routes/_authenticated.manager.tsx` (guard) + `src/routes/_authenticated.manager.index.tsx`

Layout:
- **Client filter** at top (defaults to "All my clients", dropdown of clients the manager is assigned to).
- **Date range filter** (this week / this month / custom).
- **Team summary cards**: total team hours, billable hours, # active members.
- **Team breakdown table**: per teammate — name, hours this period, last entry, % billable.
- **Recent entries list**: latest 50 entries from team members on selected client(s), with date, user, project, duration, description.

All data fetched client-side via the new RLS — no new server functions needed.

### Sidebar / routing

- `src/components/AppSidebar.tsx`: add a `managerNav` group (just "Team Overview" → `/manager`) shown when `role === "manager"`. Admins also see it (since admin sees everything).
- `src/routes/_authenticated.manager.tsx`: guard that redirects to `/dashboard` unless `role` is `manager` or `admin`.

### Admin UX additions

- **Users page**: when a user has `role = 'manager'`, the existing "Manage client assignments" dialog already does the right thing — admin assigns the manager to clients (e.g. Alizar → Orthodent). No code change needed there beyond a small label tweak ("Assign clients this user can access / manage").
- **No separate "team membership" concept**: anyone (manager or freelancer) assigned to the same client is automatically on that "team." This keeps the model simple — exactly what you described with Alizar/Rafay/Saad/Orthodent.

### What changes for managers in the rest of the app

- Their own dashboard, timer, timesheet pages keep working unchanged (they're still freelancers for their own time).
- They get one extra nav item: **Team Overview**, which is the new page above.
- They do NOT get access to admin pages (users, global reports, etc).

### Files touched

- New migration (RLS policies for `time_entries` and `profiles`)
- `src/routes/_authenticated.manager.tsx` (new — guard)
- `src/routes/_authenticated.manager.index.tsx` (new — team overview page)
- `src/components/AppSidebar.tsx` (add manager nav)
- `src/routes/_authenticated.admin.users.tsx` (small label tweak in client-assignment dialog so it makes sense for both freelancers and managers)
