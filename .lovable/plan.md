

## Auto-assign freelancers to clients/projects they create

When a freelancer adds a client or project from the dashboard, they'll be automatically assigned to it so they retain visibility. Admins always see everything — no impact on reporting.

### Database migration

1. **Update `clients` SELECT policy** — replace the current "all active clients visible" policy with one that checks either admin status OR the user has at least one project assignment under that client. Also add a new condition: the user created a `time_entry` referencing that client (covers the brief window before project assignment exists).

2. **Update `projects` SELECT policy** — the current policy still falls back to `status = 'active'` for everyone, which defeats the restriction. Replace with: admin OR exists in `project_assignments`.

3. **Drop the overly permissive INSERT policies** on `clients` and `projects` — these currently allow any authenticated user to insert with `WITH CHECK (true)`. Replace with policies that allow authenticated users to insert but only admins can insert projects without an assignment (freelancers get auto-assigned via a trigger).

4. **Create a trigger on `projects` INSERT** — after a non-admin user creates a project, automatically insert a `project_assignments` row linking that user to the new project. This is the cleanest approach because:
   - It happens at the DB level, so no client code changes are needed.
   - The freelancer immediately sees the project they just created.
   - The admin sees it too (admin RLS bypasses assignment checks).

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION public.auto_assign_project_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only auto-assign if the creator is not an admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.project_assignments (user_id, project_id)
    VALUES (auth.uid(), NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_project
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_project_creator();
```

5. **Tighten `clients` and `projects` SELECT policies:**

```sql
-- Clients: admins see all; others see only clients linked to their assigned projects
DROP POLICY "Authenticated users can view active clients" ON public.clients;
CREATE POLICY "Users can view assigned clients" ON public.clients
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN projects p ON p.id = pa.project_id
      WHERE p.client_id = clients.id AND pa.user_id = auth.uid()
    )
  );

-- Projects: admins see all; others see only assigned projects
DROP POLICY "Users can view assigned projects" ON public.projects;
CREATE POLICY "Users can view assigned projects" ON public.projects
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM project_assignments
      WHERE project_assignments.project_id = projects.id
        AND project_assignments.user_id = auth.uid()
    )
  );
```

6. **Drop overly permissive INSERT policies:**

```sql
DROP POLICY IF EXISTS "Authenticated users can add clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can add projects" ON public.projects;

-- Allow authenticated users to insert clients (admin ALL policy already covers admins)
CREATE POLICY "Authenticated users can add clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to insert projects (trigger auto-assigns them)
CREATE POLICY "Authenticated users can add projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (true);
```

### No frontend code changes needed

- The dashboard's "Add Client" and "Add Project" buttons continue to work as-is.
- The auto-assign trigger handles the linking transparently.
- RLS filters the client/project dropdowns automatically — freelancers only see their assigned data.
- Admin pages (`/admin/reports`, `/admin/entries`) use admin RLS which sees everything — total hours, all users per client, all projects.

### How admin reporting works (no changes)

| What admin sees | How |
|---|---|
| All clients and projects | `has_role(auth.uid(), 'admin')` in SELECT policies |
| All time entries from all users | `time_entries` SELECT policy allows admin access |
| All profiles | `profiles` SELECT policy allows admin access |
| Hours grouped by client/user/project | Reports page aggregates `time_entries` — unaffected |

### Summary of the workflow

1. Freelancer clicks "Add Client" → client created → freelancer adds a project under it → trigger auto-creates `project_assignment` → freelancer sees both client and project in their dropdowns.
2. Admin goes to `/admin/assignments` → sees the auto-created assignment → can assign additional freelancers to the same project.
3. Admin goes to `/admin/reports` → sees all hours for that client across all assigned freelancers.

