## Goal

Remove the draft → submitted → approved workflow. Time entries are final the moment a freelancer logs them. Admins keep an overview to sanity-check totals, but no per-entry approval gate.

## Behavior changes

**For freelancers:**
- Logging time (timer stop or manual entry) creates a final entry — no "draft" state, no "Submit" step.
- Timesheet page becomes a clean log of their entries with filters and totals (no submit buttons, no status checkboxes, no status badges).
- They can still edit/delete their own entries (no longer gated on "draft" status).

**For admins:**
- No more bulk-approve flow on Admin → Entries.
- Admin → Entries becomes a review/audit view: filters by user/client/project/date, totals at the top, full entry list. No approve buttons, no status column.
- Admin → Reports already shows summaries (hours per user, per client, per project) — this stays as the primary "validate the overall total" surface.
- A new lightweight per-user weekly summary on the Users page (clicking a user already opens stats) — already covers "do their logged hours look right".

**Status column removal everywhere:**
- Dashboard "Recent entries" — drop the `draft` badge.
- Timesheet — drop status column, status filter, submit button, checkboxes.
- Admin Entries — drop status column, status filter, approve buttons, checkboxes.
- User stats dialog — drop any status breakdown.

## Database

Two options for the existing `status` column on `time_entries`:

1. **Drop the column and the `entry_status` enum** (cleaner long-term, but is a schema change that touches RLS policies referencing `status`).
2. **Keep the column, default it to `'approved'`, backfill all existing rows to `'approved'`, and stop reading/writing it from the app.** Safer, less churn.

Recommendation: **Option 2**. Backfill all existing entries to `approved`, change default to `approved`, leave the column in place but ignore it in UI. Also relax the two RLS policies that restrict edit/delete to `status = 'draft'` so users can edit/delete any of their own entries.

## RLS changes

- `time_entries` "Users can update own draft entries" → "Users can update own entries" (drop the `status = 'draft'` clause).
- `time_entries` "Users can delete own draft entries" → "Users can delete own entries" (drop the `status = 'draft'` clause).

## Files to change

- `src/routes/_authenticated.dashboard.tsx` — remove status badge from Recent entries.
- `src/routes/_authenticated.timesheet.tsx` — remove submit flow, status column/filter, checkboxes; keep filters + totals.
- `src/routes/_authenticated.admin.entries.tsx` — remove approve flow, status column/filter, checkboxes; keep filters + totals + delete.
- `src/components/DeleteEntryButton.tsx` — verify it still works (RLS will allow now); no logic change needed.
- `src/server/admin.functions.ts` and `src/components/UserStatsDialog.tsx` — drop any status-based breakdown.
- Migration to backfill `status = 'approved'`, change default, and update the two RLS policies.

## Out of scope

- No changes to reports page logic (already aggregates by hours regardless of status).
- No changes to manager view (it doesn't gate on status).
- The `status` column and `entry_status` enum stay in the DB to avoid a destructive schema change. If you want them fully removed later, that's a follow-up.
