## Goal
Restore the 6 Orthodent / "Project Management" time entries for Sami that were wiped during the earlier HachiAI seeding. Leave Sami's 10 HachiAI entries (25h) untouched.

## Source
`OrthoDent_Total_Hours_July_-_June-2.xlsx` → Detail Timesheets, rows where Name = "Sami". All 6 rows are 2h each, project "Project Management", description "Total estimate hours spent on OrthoDent project management for June-2026".

| Date | Hours |
|---|---|
| 2025-07-30 | 2 |
| 2025-08-30 | 2 |
| 2026-03-30 | 2 |
| 2026-04-30 | 2 |
| 2026-05-30 | 2 |
| 2026-06-30 | 2 |

Total: 12 hours.

## Changes
1. Ensure Sami is on `client_assignments` for Orthodent and `project_assignments` for Orthodent → Project Management (idempotent).
2. Insert 6 `time_entries` rows for Sami:
   - `client_id` = Orthodent, `project_id` = `85394e9f-36c4-4afe-a491-fd58f9ff8f16`
   - `duration_minutes = 120`, `entry_mode = 'manual'`, `billable = true`, `status = 'approved'`
   - dates and description per table above.

No code, schema, or UI changes — data restore only.
