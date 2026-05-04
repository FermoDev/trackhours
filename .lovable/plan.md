# Settings overhaul: remove hourly rate, add password change + more

## 1. Remove hourly rate completely

Hourly rate is currently stored on `profiles.hourly_rate` and shown in:
- Settings page (input field)
- Admin Users table (a "Rate" column)
- User Stats dialog (badge in header + "Estimated billable value" card)
- `getUserStats` server function (calculates billable value)

### Changes

**Database (migration):**
- Drop the `hourly_rate` column from `public.profiles`.

**UI/code cleanup:**
- `src/routes/_authenticated.settings.tsx` — remove the Hourly rate input, state, and from the save payload.
- `src/routes/_authenticated.admin.users.tsx` — remove the "Rate" column from the table header and rows.
- `src/components/UserStatsDialog.tsx` — remove the `$X/hr` badge and the entire "Estimated billable value" card; drop `billableValue` / `hourlyRate` from the `Stats` type.
- `src/server/admin.functions.ts` (`getUserStats`) — stop selecting `hourly_rate` and stop returning `billableValue` / `hourlyRate` (still return billable minutes if useful, but no $ value).
- Comments in `src/server/manager.functions.ts` and `src/routes/_authenticated.manager.index.tsx` referencing hourly_rate get cleaned up.
- `src/integrations/supabase/types.ts` regenerates automatically after the migration.

## 2. Expand the Settings page

Settings becomes a tabbed/sectioned page with the following groups:

### A. Profile (existing, simplified)
- Email (read-only).
- Full name (editable).
- Save button with loading state (already present).

### B. Change password (NEW)
- Current password + New password + Confirm new password.
- Flow: re-authenticate by calling `supabase.auth.signInWithPassword` using the user's current email + entered current password. On success, call `supabase.auth.updateUser({ password: newPassword })`.
- Validate: new password ≥ 8 chars, matches confirm. Show success/error toast. Loader on submit, disabled while submitting.
- "Forgot current password?" link → existing `/forgot-password` route.

### C. Preferences (NEW, lightweight, stored on `profiles`)
Add small, genuinely useful per-user preferences:
- **Default billable** — when starting a new timer / manual entry, prefill billable on/off. (Switch)
- **Week starts on** — Monday vs Sunday. Used by the Weekly view. (Select)
- **Time format** — 12h vs 24h for display. (Select)

These three columns get added to `profiles` via the same migration:
- `default_billable boolean not null default true`
- `week_start_day smallint not null default 1` (0 = Sunday, 1 = Monday)
- `time_format text not null default '24h'` (check: `'12h' | '24h'`)

The Weekly view and timer/manual entry forms read these from `profile` (already loaded by `useAuth`) to set defaults. Display formatters in `src/lib/format.ts` accept the time_format preference.

### D. Account (NEW)
- **Sign out** button (already in sidebar, but mirrored here for discoverability).
- **Delete my account** — opens a confirm dialog (type "DELETE" to confirm). Calls a new `deleteOwnAccount` server function (`requireSupabaseAuth` middleware) that uses `supabaseAdmin.auth.admin.deleteUser(userId)` after verifying the caller is not the only admin. Cascades wipe their profile/role/entries via existing FK behavior (or we explicitly delete in the function).

### E. Admin quick links (existing, unchanged)
Kept for admins only.

## 3. Files touched

**New:**
- `supabase/migrations/<timestamp>_settings_overhaul.sql` — drop `hourly_rate`, add `default_billable`, `week_start_day`, `time_format`.
- `src/server/account.functions.ts` — `deleteOwnAccount` server fn.

**Edited:**
- `src/routes/_authenticated.settings.tsx` — full rewrite into sections (Profile, Password, Preferences, Account, Admin links).
- `src/routes/_authenticated.admin.users.tsx` — drop Rate column.
- `src/components/UserStatsDialog.tsx` — drop billable value card & rate badge.
- `src/server/admin.functions.ts` — drop hourly rate from `getUserStats`.
- `src/lib/format.ts` — accept optional 12h/24h preference.
- `src/routes/_authenticated.weekly.tsx` — honor `week_start_day`.
- `src/routes/_authenticated.dashboard.tsx` + manual-entry form — honor `default_billable`.

## 4. Notes / questions

- Do you want me to also expose **Default billable / Week start / Time format** preferences right now, or keep this round focused on just **remove rate + change password**? They're small but each touches a couple of other screens. I'll default to including them — say the word if you'd rather skip and I'll trim the plan.
- Account deletion is a sharp tool — confirm you want self-serve delete; otherwise I'll leave only "Sign out" in the Account section and let admins handle deletions.
