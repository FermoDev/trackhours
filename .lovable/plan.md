

## Client-based assignments from the Users page

### Current problem
Assignments are project-based (`project_assignments` table), but you think in terms of clients. You want to click a user and assign them to clients directly, and the Assignments page should also work by client.

### New approach: client-level assignments

**1. Database migration**

Create a `client_assignments` table:

```sql
CREATE TABLE public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client assignments"
  ON public.client_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own client assignments"
  ON public.client_assignments FOR SELECT
  USING (auth.uid() = user_id);
```

Update RLS on `clients` and `projects` to use `client_assignments` instead of deriving from `project_assignments`:

```sql
-- Clients: user sees clients assigned to them
DROP POLICY "Users can view assigned clients" ON public.clients;
CREATE POLICY "Users can view assigned clients" ON public.clients
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM client_assignments ca
      WHERE ca.client_id = clients.id AND ca.user_id = auth.uid()
    )
  );

-- Projects: user sees projects under their assigned clients, or ones they created
DROP POLICY "Users can view assigned projects" ON public.projects;
CREATE POLICY "Users can view assigned projects" ON public.projects
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM client_assignments ca
      WHERE ca.client_id = projects.client_id AND ca.user_id = auth.uid()
    )
  );
```

Keep the `project_assignments` table for now (existing data), but visibility no longer depends on it.

**2. Users page (`_authenticated.admin.users.tsx`)**

- Make each user row clickable (or add a "Clients" button in actions).
- Clicking opens a dialog showing that user's assigned clients as badges/chips with an X to remove.
- A dropdown at the bottom to add more clients.
- Changes save immediately (insert/delete on `client_assignments`).

**3. Assignments page (`_authenticated.admin.assignments.tsx`)**

- Change from project-based to client-based view.
- Table columns: User, Client, Assigned date, Remove button.
- The "+ Assign" dialog asks for User and Client (not Project).
- Inserts into `client_assignments` instead of `project_assignments`.

**4. Auto-assign trigger update**

Update the existing `auto_assign_project_creator` trigger to also insert a `client_assignments` row for the project's client, so freelancers who create a project automatically get assigned to that client too.

### What changes for freelancers

| Before | After |
|---|---|
| See clients derived from project assignments | See clients directly assigned to them |
| See only specifically assigned projects | See all projects under assigned clients + ones they created |
| Admin assigns per-project | Admin assigns per-client (simpler) |

### No impact on reporting
Admin RLS bypasses all assignment checks -- total hours, all users, all clients remain fully visible.

