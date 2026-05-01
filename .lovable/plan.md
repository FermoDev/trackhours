## Goals

1. Add consistent loading indicators across the entire app so users never wonder if an action is in progress.
2. On the Admin → Users page, make each user's name clickable to open a stats modal showing their time totals, top projects, and recent activity.

---

## Part 1 — Loading indicators (everywhere)

Apply one consistent pattern using `Loader2` from `lucide-react`:

```tsx
<Button onClick={handle} disabled={loading || invalid}>
  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
  {loading ? "Signing in…" : "Sign in"}
</Button>
```

For data-heavy pages, replace empty states with the existing `Skeleton` component while data is loading.

### Auth pages (highest priority — direct user complaint)
- `src/routes/login.tsx` — add `Loader2` spinner inside the "Sign in" button.
- `src/routes/signup.tsx` — spinner on "Create account".
- `src/routes/forgot-password.tsx` — spinner on "Send reset link".
- `src/routes/reset-password.tsx` — spinner on "Update password".

### Dashboard (`_authenticated.dashboard.tsx`)
- Start / Stop / Pause / Resume timer buttons: spinner when `timerLoading` is true (currently only disabled, no visual feedback).
- "Add entry" (manual): add `submitting` state + spinner.
- Quick-start tiles in recent projects: per-tile pending state with spinner on the clicked one.
- Add Client / Add Project dialog buttons: spinner icon next to existing "Saving…" text.

### Timesheet / Weekly / Settings
- `_authenticated.timesheet.tsx` — "Submit selected" gets `submitting` state + spinner; skeleton rows while entries fetch.
- `_authenticated.weekly.tsx` — Save dialog button + spinner; skeleton week grid on load.
- `_authenticated.settings.tsx` — spinner icon on "Save" (text already exists).

### Admin pages
- `_authenticated.admin.users.tsx` — already has busy spinners on row actions; add page-load skeleton rows.
- `_authenticated.admin.clients.tsx` — Add / Save / Merge / Archive / Delete buttons get spinners.
- `_authenticated.admin.projects.tsx` — spinner icon on existing `merging`; `saving` state on "Add" button.
- `_authenticated.admin.assignments.tsx` — Assign / Delete buttons spinner; loading state for table.
- `_authenticated.admin.entries.tsx` — Bulk approve / single approve / delete buttons spinner; skeleton table on load.
- `_authenticated.admin.reports.tsx` — Export CSV spinner while building file; loading state for filtered query.
- `_authenticated.admin.index.tsx` — `Skeleton` cards instead of "0 0 0 0" flash while stats load.
- `_authenticated.manager.index.tsx` — replace plain "Loading…" with `Loader2` + skeleton stat cards.

### Shared
- `src/components/StickyTimer.tsx` — spinner on the Stop button.
- `src/components/DeleteEntryButton.tsx` — ensure spinner icon during delete.
- `src/routes/_authenticated.tsx` — replace plain "Loading…" with a centered `Loader2` for visual polish.

### Implementation notes (technical)
- Use `Loader2` with `className="h-4 w-4 mr-2 animate-spin"` (or `h-3 w-3` in compact buttons).
- Always pair with `disabled={loading}` to prevent double-submit.
- For per-row async actions, track `pendingId: string | null` rather than a global flag so only the clicked row spins.
- Reuse `src/components/ui/skeleton.tsx` for placeholders. No new dependencies.

---

## Part 2 — User stats modal on Admin → Users

### Behavior
- The user's name in the table becomes a clickable button (link styling, hover underline).
- Clicking it opens a `Dialog` titled "{full_name} — Activity".
- Modal renders a loading state while fetching, then the stats below.

### Stats shown
- **Header**: name, email, role badge, status badge, hourly rate (if set).
- **Totals**: 4 stat cards — Today, This week, This month, All time (hours, formatted `Xh Ym`).
- **Top clients** (max 5): client name + total hours over the last 90 days, sorted desc.
- **Top projects** (max 5): project name (with client) + total hours over last 90 days, sorted desc.
- **Recent entries** (last 10): date, client → project, duration, status badge.
- **Estimated billable value** (only if `hourly_rate` is set): all-time billable hours × hourly_rate, displayed under totals.

### Data source
A new server function `getUserStats(userId)` in `src/server/admin.functions.ts`:
- Admin-only (verified via existing `authHeaders` + role check pattern used by other admin functions).
- Runs queries against `time_entries` joined with `clients` and `projects` for that `user_id`, computing the aggregates above with simple SQL using the service-role client.
- Returns a single typed payload `{ totals, topClients, topProjects, recentEntries, billableValue }`.

### UI implementation
- New component `src/components/UserStatsDialog.tsx` taking `{ user, open, onOpenChange }`.
- Uses `Loader2` centered while loading; renders cards using existing `Card` / `Badge` primitives, formatted via `src/lib/format.ts` helpers.
- Wired into `_authenticated.admin.users.tsx`: name cell becomes `<button onClick={() => setStatsUser(p)}>` with hover styling; `<UserStatsDialog user={statsUser} open={!!statsUser} onOpenChange={...} />` rendered alongside the existing client-assignments dialog.

### Out of scope
- Editable stats / inline editing.
- CSV export from this modal (admin already has Reports page with CSV).
- Charts/graphs — stick to numbers and lists for now (we can add later if you want).

---

## Files touched (summary)
- All auth, dashboard, timesheet, weekly, settings, admin, manager pages — small loading state additions.
- `src/components/StickyTimer.tsx`, `src/components/DeleteEntryButton.tsx`, `src/routes/_authenticated.tsx` — polish.
- New: `src/components/UserStatsDialog.tsx`.
- Edit: `src/server/admin.functions.ts` (add `getUserStats`).
- Edit: `src/routes/_authenticated.admin.users.tsx` (clickable name + dialog).

No DB migrations, no schema changes, no new dependencies.