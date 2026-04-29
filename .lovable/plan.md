## Add ability to delete time log entries

Users can currently create time logs but there's no way to remove one if added by mistake. The database already permits it (RLS policy "Users can delete own draft entries" allows deleting your own entries while in `draft` status; admins can delete any). We just need UI.

### Where to add delete buttons

1. **Dashboard — "Recent entries" list** (`src/routes/_authenticated.dashboard.tsx`)
   - Add a small trash icon button next to each entry row (alongside the existing "Continue" button).
   - Only show it for entries where `status === "draft"` (submitted/approved entries are locked by RLS anyway).

2. **Timesheet page — entries table** (`src/routes/_authenticated.timesheet.tsx`)
   - Add a trailing "Actions" column with a trash icon for each draft row.
   - Keeps parity with the existing checkbox/submit flow.

### Behavior

- Clicking the trash icon opens an `AlertDialog` confirmation ("Delete this time entry? This cannot be undone.") to prevent accidental clicks.
- On confirm: `supabase.from("time_entries").delete().eq("id", entry.id)`, then refetch the list and show a toast ("Entry deleted").
- If the delete fails (e.g. entry was already submitted by the time they click), surface the error in a toast.
- Only render the delete button when `entry.status === "draft"`. Submitted/approved entries should not show the button — users would need to ask an admin.

### Admin entries page

`src/routes/_authenticated.admin.entries.tsx` already exists for admins. I'll quickly check if it has delete; if not, add the same trash-with-confirm pattern there too (admins can delete entries in any status).

### No backend changes needed

The RLS policies already cover this:
- Users: can delete own `draft` entries
- Admins: can delete any entry

### Files to edit

- `src/routes/_authenticated.dashboard.tsx` — trash button on recent entry rows
- `src/routes/_authenticated.timesheet.tsx` — actions column with trash button
- `src/routes/_authenticated.admin.entries.tsx` — trash button if missing (will verify first)
