

## Add role management, disable, and delete for admins

Today `/admin/users` only displays role/status and resets passwords. I'll add admin-only controls for changing roles, disabling/re-enabling users, and deleting users. Freelancers cannot escalate their own role — RLS already blocks that, and the new server functions re-verify admin status.

### Server functions (`src/server/admin.functions.ts`)

Add three new functions, all wrapped in `requireSupabaseAuth` + admin check (same pattern as `adminResetPassword`):

1. **`adminUpdateUserRole`** — input `{ userId, role: 'admin' | 'freelancer' | 'manager' }`. Uses `supabaseAdmin` to upsert into `user_roles`. Guards:
   - Caller must be admin.
   - Caller cannot demote themselves (prevents locking out the last admin by accident).
   - If demoting an admin and they are the only admin left → reject with "At least one admin must remain".

2. **`adminSetUserStatus`** — input `{ userId, status: 'active' | 'inactive' }`. Updates `profiles.status`. When set to `inactive`, also calls `supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })` (≈100 years) to block sign-in. Reactivating clears the ban (`ban_duration: 'none'`). Caller cannot disable themselves.

3. **`adminDeleteUser`** — input `{ userId }`. Calls `supabaseAdmin.auth.admin.deleteUser(userId)` — this cascades to `profiles`, `user_roles`, `time_entries`, `project_assignments`, `activity_logs` via existing FKs / cascade rules. Caller cannot delete themselves; cannot delete the last admin.

### UI changes (`src/routes/_authenticated.admin.users.tsx`)

Add an **Actions** column with:

- **Role `<Select>`** inline (admin / manager / freelancer) — changes commit immediately with toast confirmation. Disabled on the current admin's own row.
- **Disable / Enable toggle button** — `Power` icon. Confirms via `AlertDialog` ("This user will no longer be able to sign in."). Disabled on own row.
- **Delete button** — `Trash2` icon, red. `AlertDialog` confirmation: "Permanently delete {email} and all their time entries? This cannot be undone." Disabled on own row.
- **Existing "Reset Password" button** stays.

Also:
- Pass current admin's `user.id` into the page (via `useAuth`) to disable self-targeted destructive actions.
- After any successful mutation, refetch the users list.
- Sort: admins first, then by name, so role changes are visually obvious.

### Why freelancers can't change their own role

- DB enforcement: RLS on `user_roles` allows `SELECT` only for own row; all writes require `has_role(auth.uid(), 'admin')`. A freelancer calling `supabase.from('user_roles').update(...)` from the browser is rejected by Postgres.
- Server enforcement: every new admin function re-verifies the caller's role via `supabaseAdmin` before doing anything.
- UI enforcement: the role/disable/delete controls only render on `/admin/users`, which is already inside the admin route guard.

### Out of scope

- No schema changes (existing `user_roles`, `profiles.status`, and Supabase Auth ban mechanism cover this).
- No bulk actions, no audit log entries beyond what `activity_logs` already captures (can add later if you want).
- Manager role permissions are not changed — `manager` exists in the enum but currently behaves like a freelancer; tell me if you want me to wire it up to specific admin-lite capabilities.

