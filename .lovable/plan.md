## Audit findings

The recurring breakage is not one single UI bug. The workflow has been unstable because the app currently mixes three conflicting models:

1. **UI says freelancers can add clients/projects**, but the database policies were later changed to allow only admins to insert directly.
2. **Dashboard uses server functions for freelancer creation**, which is the right idea, but those server functions are protected by auth middleware and the app is missing the global bearer-token attachment (`attachSupabaseAuth`). I reproduced this in the browser: clicking **Add** sends the server function request and it returns **401**, so the modal stays open.
3. **Admin pages bypass the shared creation logic** and insert clients/projects directly from the browser, so duplicate/merge behavior and creator visibility are inconsistent.
4. **Data model is half-migrated**: `clients.created_by` exists but old rows are `null`; `projects.created_by` exists; assignments exist; project auto-assign exists only for projects, not clients. This explains why visibility/ownership has drifted over time.

## Product rule to implement

- Every signed-in user can add a client or project from the freelancer dashboard.
- If the typed name exactly matches or is very similar to an existing client/project, the user should be connected to the existing record instead of creating a duplicate.
- Users should only see clients/projects they created or have been connected/assigned to.
- Admins should see all clients/projects and who created them.
- The timer/manual-entry description fields remain mandatory and unchanged.

## Implementation plan

### 1. Fix authenticated server-function calls

- Add/register the global auth attachment for server functions so `findOrCreateClient` and `findOrCreateProject` receive the signed-in user token instead of failing with 401.
- This is the root cause of the modal not closing after clicking **Add**.

### 2. Move client/project server functions to a client-safe location

- Move `clients.functions.ts` out of `src/server/` into `src/lib/clients.functions.ts`.
- Update imports in dashboard/admin pages.
- Keep privileged helper logic server-side, but avoid the current import-protection/auth-splitting risk caused by importing server functions from `src/server/`.

### 3. Make creation/merge logic deterministic

- Update `findOrCreateClient`:
  - Normalize names: trim, collapse whitespace, compare case-insensitively.
  - Exact match: connect the user to the existing client.
  - Similar match: default to connecting/merging to the existing client, not leaving the modal stuck behind a confusing second flow.
  - No match: create the client with `created_by = current user`, then create a `client_assignments` row.
- Update `findOrCreateProject`:
  - Project matching is scoped to the selected client.
  - Exact/similar match: connect the user to the existing project and client.
  - No match: create with `created_by = current user`, then create both `project_assignments` and `client_assignments` rows.
- Use conflict-safe inserts for assignments so repeated adds do not fail.

### 4. Fix dashboard UI state after add

- After successful **Add Client**:
  - close modal
  - refresh data
  - select the client
  - open the timer form so the user sees the selected client
- After successful **Add Project**:
  - close modal
  - refresh data
  - select the client and project
  - open the timer form so the new/existing project is visibly selected
- Remove the current fuzzy confirmation interruption if we’re auto-merging similar names as requested.
- Keep the existing “What are you working on?” and manual-entry description requirements unchanged.

### 5. Align admin pages with the same source of truth

- Admin Clients list: include creator information by joining `profiles` through `created_by` and display creator name/email.
- Admin Projects list: include creator information and client name.
- Admin add actions should use the same find/create functions where appropriate, or explicitly remain admin-only direct creation if admin needs a separate management flow. The key is that admin listing shows full data and creator attribution.

### 6. Database migration for access consistency

- Add a client auto-assignment trigger for direct client inserts, so any future non-server-function client creation still assigns the creator.
- Make the existing project auto-assignment trigger reliable for both client and project assignment.
- Keep RLS strict:
  - normal users can view only created/assigned/merged clients and projects
  - admins can view/manage everything
- Add/confirm indexes for fast exact/similar matching.
- Backfill `created_by` where possible only if there is a safe source; otherwise leave old shared records visible through assignments.

### 7. Test before declaring fixed

I will test this in-browser using the current logged-in preview session:

- Add a brand-new client -> modal closes, client selected in timer form.
- Add a brand-new project under that client -> modal closes, project selected in timer form.
- Add a misspelled/similar client/project -> joins existing instead of duplicating.
- Confirm network has no 401 server-function requests.
- Confirm admin client/project tables show all records with creator info.

## Files expected to change

- `src/router.tsx` or the app start/bootstrap file used by this template for server-function middleware
- `src/lib/clients.functions.ts` new/moved server functions
- `src/routes/_authenticated.dashboard.tsx`
- `src/routes/_authenticated.admin.clients.tsx`
- `src/routes/_authenticated.admin.projects.tsx`
- one database migration for triggers/RLS consistency