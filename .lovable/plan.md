## Why role changes silently fail

I traced the exact problem in the network log:

```
POST /_serverFn/...adminUpdateUserRole
Status: 401
Response: "Unauthorized: No authorization header provided"
```

Every admin server function (`adminUpdateUserRole`, `adminSetUserStatus`, `adminDeleteUser`, `adminResetPassword`) is protected by `requireSupabaseAuth` middleware, which expects an `Authorization: Bearer <token>` header. But on the client we just call `adminUpdateUserRole({ data: ... })` with no header — TanStack Start's server-fn fetch does NOT auto-attach the Supabase session token.

So: the request leaves the browser with no auth header → middleware rejects with 401 → role never updates → UI silently re-renders the old role. The error isn't even toasted because the catch block on `handleRoleChange` is missing.

### Fix: attach the JWT before each call

Add a tiny helper that grabs the current Supabase session token and merges it into the server-fn `headers` option (TanStack Start supports per-call headers). Then update the four admin call sites to use it.

**New file `src/lib/server-auth.ts`:**
```ts
import { supabase } from "@/integrations/supabase/client";

export async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}
```

**Update `src/routes/_authenticated.admin.users.tsx`:**
```ts
const headers = await authHeaders();
const result = await adminUpdateUserRole({ data: { userId, role }, headers });
```
Same pattern for `adminResetPassword`, `adminSetUserStatus`, `adminDeleteUser`. Also add a `catch` that toasts the error so future failures aren't silent.

That single change makes role changes (and reset-password / disable / delete) actually work.

---

## How the manager role works end-to-end (the model)

Think of it as one shared list — `client_assignments` — that powers everything:

```text
client_assignments
  Alizar  → Orthodent   (role=manager)
  Rafay   → Orthodent   (role=freelancer)
  Saad    → Orthodent   (role=freelancer)
```

Anyone (manager or freelancer) on the same client is automatically on the same "team." There is no separate team table.

### What each role can do (enforced in the database, not the UI)

| Action | Admin | Manager | Freelancer |
|---|---|---|---|
| Track own time | yes | yes | yes |
| See clients/projects | all | only assigned | only assigned |
| See OWN time entries | yes | yes | yes |
| See TEAMMATE time entries on shared clients | yes (all) | yes (their clients only) | no |
| See teammate names/emails | yes | yes (only teammates on shared clients) | no |
| Manage users / global reports / billing | yes | no | no |

### Concrete walk-through: Alizar manages Rafay & Saad on Orthodent

1. **Admin sets it up (one-time)**
   - In Users → set Alizar's role to `manager` (this is what's currently broken — fix above)
   - In Users → click Alizar's "client assignments" → add **Orthodent**
   - Make sure Rafay and Saad are also assigned to Orthodent (freelancers)

2. **Rafay logs time**
   - Rafay opens the timer, picks Orthodent → some project, starts/stops
   - Row written to `time_entries` with `user_id=Rafay, client_id=Orthodent`

3. **Alizar opens "Team Overview"** (the new `/manager` page)
   - Page queries `time_entries` with no user_id filter
   - Postgres RLS evaluates each row:
     - Alizar's own rows → allowed by "Users can view own entries"
     - Rafay/Saad rows on Orthodent → allowed by **"Managers can view team entries on assigned clients"** because Alizar has `role=manager` AND `client_assignments(Alizar, Orthodent)` exists
     - A row from someone on a different client → denied
   - Same logic for the `profiles` query, which is why Alizar can see Rafay's & Saad's names

4. **Alizar does NOT get**
   - Admin pages (Users, global reports, etc.) — sidebar hides them, and even if URL is typed admin RLS denies
   - Time entries from clients she isn't assigned to

### Where this lives in code (already built, just needs the fix above to be reachable)

- **DB policies** (already applied):
  - `time_entries`: "Managers can view team entries on assigned clients"
  - `profiles`: "Managers can view teammate profiles"
- **Sidebar** `src/components/AppSidebar.tsx`: shows "Team Overview" for `manager` and `admin`
- **Guard** `src/routes/_authenticated.manager.tsx`: redirects non-managers to `/dashboard`
- **Page** `src/routes/_authenticated.manager.index.tsx`: the dashboard with client filter, date range, summary cards, per-teammate breakdown, recent entries

### Why managers don't need their own timesheet view of teammates

The existing **Team Overview** page already shows recent team entries with date, user, project, duration, and description — that IS the team timesheet. If you want a richer per-teammate week-grid view later, that can be added on top of the same RLS without any DB change.

---

## Files touched by this plan

- New: `src/lib/server-auth.ts` (5-line helper)
- Edit: `src/routes/_authenticated.admin.users.tsx` — pass `headers` to all four admin server-fn calls + add error toasts

No DB changes. No new RLS. The manager backend is already wired up; you just couldn't change anyone TO manager because the role-change request was 401-ing.
