## Add minutes/hours unit selector to manual entry inputs

Right now the manual time entry inputs in two places force the user to type minutes:
- Dashboard → "Manual entry" form (`src/routes/_authenticated.dashboard.tsx`, line 380)
- Weekly view → "Add time" dialog (`src/routes/_authenticated.weekly.tsx`, line 250)

### Change

Next to each numeric duration input, add a small unit dropdown with two options: **Hours** and **Minutes**. Default to **Hours** (since the rest of the app reports in hours). The user types a number, picks the unit, and we convert to minutes before saving — the database column stays `duration_minutes` and every existing display/report (dashboard totals, weekly totals, timesheet, admin reports, manager view) continues to render via `formatDuration` unchanged.

Conversion when saving:
- Hours → `Math.round(parseFloat(value) * 60)`
- Minutes → `parseInt(value)`

Hours allows decimals (e.g. `1.5` = 90 min), so the input uses `step="0.25"` when Hours is selected and `step="1"` when Minutes is selected. Placeholder updates to "Hours" / "Minutes".

### Files touched

1. `src/routes/_authenticated.dashboard.tsx` — add `manualUnit` state (`"h" | "m"`), wrap input + Select in a flex row, convert in `handleManualEntry`.
2. `src/routes/_authenticated.weekly.tsx` — add `dialogUnit` state, wrap input + Select inside the Add Time dialog, convert in `saveEntry`.

No DB migration. No changes to display formatting, reports, or the timer (timer already produces minutes from elapsed seconds).

### Out of scope

Per your note that "everything will be calculated hourly", the underlying storage stays in minutes (changing the column would break existing data and every aggregate). All user-visible totals already render as `Xh Ym` / hours via `formatDuration` and `formatHoursDecimal` — nothing reads "minutes" to the user. If you want totals shown as pure decimal hours (e.g. `7.5h` instead of `7h 30m`) anywhere specific, tell me which screens and I'll switch those to `formatHoursDecimal`.