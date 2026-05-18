## Problem

The previous migration (`20260518122522_…_security_hardening`) revoked `EXECUTE` on `public.has_role(uuid, app_role)` and `public.get_user_role(uuid)` from the `authenticated` and `anon` roles.

These functions are referenced by RLS policies on almost every table (`user_roles`, `profiles`, `clients`, `projects`, `time_entries`, `client_assignments`, `project_assignments`, `activity_logs`). When the policy is evaluated for a logged-in user, Postgres tries to call `has_role` and fails with a permission-denied error — so the admin's queries silently return nothing and the admin UI looks empty.

Verified in DB: `sami@fermo.io` is correctly assigned role `admin` in `user_roles`. The bug is purely in the permission grants.

`has_role` and `get_user_role` are `SECURITY DEFINER` with a locked `search_path` — they are safe to expose to `authenticated`. That's the whole point of the recommended user-roles pattern.

The auto-assign trigger functions (`auto_assign_client_creator`, `auto_assign_project_creator`) are also fine to keep restricted because they are only invoked by triggers (which run as the table owner), not called directly by clients. Same for `handle_new_user`.

## Fix

One new migration that re-grants `EXECUTE` on the two role-check functions to `authenticated` (and `anon`, harmless and matches Supabase defaults):

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO anon, authenticated;
```

No code changes needed. After approval and migration run, the admin dashboard, user list, client/project admin pages, and any other RLS-gated data will become visible again to `sami@fermo.io` and any other admin.

## Verification

1. Reload `/admin` as `sami@fermo.io` — admin sidebar entries and lists populate.
2. Freelancer accounts should also stop seeing empty client/project lists (the same policies failed for them too on any branch with `OR has_role(...)`).
