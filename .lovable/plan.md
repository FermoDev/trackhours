## Goal
Let any authenticated user delete projects (and similarly clients) they have access to, not just admins.

## Current state
- `projects` table RLS only allows DELETE for admins (`Admins can delete projects` + `Admins full access to projects`).
- `clients` table is the same.
- Freelancers see projects they created or are assigned to, but cannot remove them — even ones they created by mistake.

## Proposed changes

### 1. Database migration (RLS)
Add per-user DELETE policies:

- **projects**: allow DELETE when `created_by = auth.uid()` OR user is admin (already covered by admin ALL policy).
- **clients**: allow DELETE when `created_by = auth.uid()` AND no other user has time entries / assignments on it, OR user is admin. This prevents one user deleting a client another user is actively tracking against.
- Add ON DELETE cleanup: when a project is deleted, also remove its `project_assignments` and `time_entries` rows (cascade via trigger or explicit policy + cascade). Same for clients.

Safety rule for clients: only the creator can delete, and only if they're the *only* user with data on it. Otherwise show "contact admin to delete".

### 2. Server functions (`src/lib/clients.functions.ts`)
- Add `deleteProject({ projectId })` — checks auth, calls `supabase.from('projects').delete()`. RLS enforces who can actually delete.
- Add `deleteClient({ clientId })` — same pattern.
- Both return `{ success, error }` shape; surface friendly error if RLS blocks.

### 3. UI
- **Projects list** (user-facing + admin): add a delete button (trash icon) on each row with a confirm dialog ("Delete project X? This removes all time entries on it."). Wire to `deleteProject` server fn, then invalidate the projects query.
- **Clients list**: same pattern, with the stricter confirm copy ("Only possible if you're the only user with time on this client").
- Hide/disable the button only when RLS would clearly reject (e.g. freelancer viewing someone else's project via assignment) — otherwise let the server respond and toast the error.

### 4. Activity log
Insert a row into `activity_logs` on each delete (`action: 'project.deleted'` / `'client.deleted'`, metadata with name + id) so admins keep an audit trail.

## Out of scope
- No changes to roles, auth, or who can *create* clients/projects.
- No soft-delete / archive — straight hard delete with cascade. Can revisit if you want a recycle bin.

## Files touched
- new migration under `supabase/migrations/`
- `src/lib/clients.functions.ts` (+ `clients.server.ts` if helpers needed)
- projects list route (`src/routes/_authenticated.projects.tsx` or wherever the list lives) and admin equivalents
- clients list route + admin equivalent

Confirm and I'll implement, or tell me if you want clients excluded / soft-delete instead.
