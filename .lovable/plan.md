## What's broken

Your account `sami@fermo.io` IS correctly stored as `admin` in the database — I verified the `user_roles` row. The problem is that the app can't read role information anymore, so every signed-in user falls back to the freelancer view.

## Root cause

The recent security-hardening migration revoked `EXECUTE` on the `has_role`, `get_user_role`, and `handle_new_user` functions from the `authenticated` and `anon` roles. The current ACL only grants execute to `postgres`, `service_role`, and `sandbox_exec`.

The problem: `has_role(auth.uid(), 'admin')` is referenced inside almost every Row-Level Security policy in this project (clients, projects, profiles, time_entries, user_roles, activity_logs, etc.). When a logged-in user runs *any* query, Postgres evaluates those RLS expressions as the `authenticated` role — which no longer has permission to call `has_role`. The policy expression errors or returns false, so:

- The `user_roles` SELECT for the current user fails / returns nothing → `role` stays `null` in `useAuth` → sidebar and `_authenticated.admin` guard treat the user as a freelancer.
- The `handle_new_user` trigger (used on signup) can no longer create profile + default role rows.

That migration was over-aggressive. `SECURITY DEFINER` + a locked `search_path` is what makes these helpers safe — they're *designed* to be called by `authenticated` from inside RLS. Revoking EXECUTE on them breaks the whole authorization model.

## Fix

Add a small migration that restores EXECUTE on these three functions:

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;
```

(`anon` is included because the auth signup trigger and the unauthenticated landing flow can touch them.)

The other security improvements from that migration stay in place:
- `clients` / `projects` INSERT remains admin-only.
- The manager profile-leak fix (sanitized teammate fetch via server function) stays.
- `auto_assign_project_creator` and `update_updated_at_column` permissions are unchanged.

## After applying

- Refresh the app and sign in as `sami@fermo.io`.
- The sidebar should show the Admin section, and `/admin` should load.
- Other users keep working at their existing roles.
- New signups will once again get a `profiles` row + default `freelancer` role created automatically.

## Update security memory

I'll update the security memory to note that `has_role` / `get_user_role` are intentionally callable by `authenticated` (they're `SECURITY DEFINER` with a fixed `search_path`) so a future scan won't try to re-revoke them.
