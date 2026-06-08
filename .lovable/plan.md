# Remove `manager` from `app_role` enum

The `manager` role is no longer used by the app but still exists in the DB enum. Postgres can't drop an enum value directly, so we recreate the enum.

## Safety checks
- All `user_roles` with `role = 'manager'` were already demoted to `freelancer` in the previous migration — the value is unused.
- Only `user_roles.role` references `app_role`.
- `public.has_role(uuid, app_role)` takes the enum as a parameter and must be recreated against the new type.

## Migration steps (single migration)

1. Safety net: `UPDATE public.user_roles SET role = 'freelancer' WHERE role::text = 'manager';`
2. Drop `public.has_role(uuid, app_role)` (depends on the type).
3. Rename `app_role` → `app_role_old`.
4. Create new `CREATE TYPE public.app_role AS ENUM ('admin', 'freelancer');`
5. `ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;`
6. `DROP TYPE public.app_role_old;`
7. Recreate `public.has_role(_user_id uuid, _role public.app_role)` (same body, `SECURITY DEFINER`, `SET search_path = public`).

## Post-migration
- Regenerated `src/integrations/supabase/types.ts` will list only `'admin' | 'freelancer'`.
- Remove the now-unnecessary `roleRes.data.role !== "manager"` filter in `src/lib/auth.tsx` (cosmetic; harmless if left).
- Update memory: change "DB enum value kept but unused" → "manager role fully removed".

No app-visible behavior changes.
