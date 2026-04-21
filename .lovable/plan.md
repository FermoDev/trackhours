

## Simplify client/project visibility rules

### Summary of changes

- **Clients**: Only admins can create clients. Remove the "Add Client" button and dialog from the freelancer dashboard. Freelancers see only clients that have at least one project assigned to them (current RLS is already correct for this).
- **Projects**: Freelancers can add projects under clients assigned to them. They see projects they created OR projects assigned to them. Admins see all.
- Add a `created_by` column to `projects` so we can track who created a project and let them see it.

### Database migration

1. **Add `created_by` column to `projects`** (nullable UUID, defaults to `auth.uid()`):

```sql
ALTER TABLE public.projects ADD COLUMN created_by uuid DEFAULT auth.uid();
```

2. **Update `projects` SELECT policy** to include projects the user created:

```sql
DROP POLICY "Users can view assigned projects" ON public.projects;
CREATE POLICY "Users can view assigned projects" ON public.projects
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.project_id = projects.id
        AND project_assignments.user_id = auth.uid()
    )
  );
```

3. **Restrict client INSERT to admins only** — drop the permissive INSERT policy for all authenticated users:

```sql
DROP POLICY "Authenticated users can add clients" ON public.clients;
```

The existing "Admins full access to clients" ALL policy already covers admin inserts.

4. **Keep project INSERT as-is** — authenticated users can still add projects. The auto-assign trigger ensures they get assigned.

### Frontend changes (`src/routes/_authenticated.dashboard.tsx`)

1. **Remove** all "Add Client" UI: the `addClientOpen` state, `newClientName` state, `handleAddClient` function, the `+` button next to client selects (in both timer and manual entry forms), and the Add Client dialog.
2. **Keep** the "Add Project" button and dialog — freelancers can still add projects under their assigned clients.

### No other file changes needed

- Client visibility RLS already filters correctly (only shows clients with assigned projects).
- Admin pages are unaffected (admin RLS sees everything).
- The auto-assign trigger still fires when a freelancer creates a project.

