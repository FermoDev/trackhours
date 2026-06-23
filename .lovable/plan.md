## Goal

1. Wipe Orthodent completely (entries, projects, assignments, invoice links).
2. Re-import the 143 rows from your sheet's **Detail Timesheets** tab with the exact project names, descriptions, dates, hours, and people.
3. Update the "Download timesheet" export on the Clients page so future downloads come out in the same two-tab format as this file.

## Name matches (please confirm)

The sheet uses these names. 3 match exactly; 2 need your OK:

| Sheet name | DB profile | Note |
|---|---|---|
| Abdul Rafay | Abdul Rafay | exact |
| Alizar Lalani | Alizar Lalani | exact |
| Sami | Sami | exact |
| Waseem | **Waseem Hussain** | first-name only in sheet — same person? |
| Saad Akhtar Khan | **Saad Akhter Khan** | spelling differs (Akht**a**r vs Akht**e**r) — same person? |

Assuming yes to both, every one of the 143 rows maps to a real freelancer with no unknowns.

## Reset (one migration / data op)

Run in this order against the Orthodent client `53834128-cc80-4789-8031-2f0145d3d814`:

1. `UPDATE invoices SET status='void'` and `DELETE FROM invoice_line_items` for any invoice tied to Orthodent entries (so the wipe is clean and no orphan line items remain).
2. `DELETE FROM time_entries WHERE client_id = orthodent`.
3. `DELETE FROM project_assignments WHERE project_id IN (orthodent projects)`.
4. `DELETE FROM projects WHERE client_id = orthodent`.
5. Keep the Orthodent **client row itself** and its `client_assignments` (so admins/freelancers stay attached).

## Import

For each of the 22 unique project names in the sheet:
- Create a project under Orthodent with that exact name, status `active`, `created_by` = an admin (Sami).
- Auto-assign every user who has entries on that project (via `project_assignments`).

For each of the 143 rows, insert a `time_entries` row with:
- `user_id` from the name map above
- `client_id` = Orthodent
- `project_id` from the project just created
- `entry_date` = the Date column
- `duration_minutes` = Hours × 60
- `description` = Task / Description column
- `billable` = true, `invoice_id` = null, `start_time`/`end_time` = null (manual entry)

I'll do this as a single transactional SQL block so it either all lands or nothing changes.

## Excel export — match this sheet's format

Currently `src/lib/exportClientTimesheet.ts` produces: Summary / By Project / one tab per freelancer. Your sheet has a different shape, so I'll replace it with:

**Tab 1 — "Hours per person by project"** (pivot-style)
- Top block "Project by Month – Hours": rows = Project, columns = Year-Month (chronological), values = sum of hours, with a Grand Total row + column.
- Bottom block "Project by People – Hours": rows = Project, columns = Person, values = sum of hours, Grand Total row + column.
- Same header labels and layout as your file.

**Tab 2 — "Detail Timesheets"**
- Exact 6 columns in this order: `Name | Date | Year-Month | Hours | Task / Description | Project`
- One row per `time_entries` row, sorted by Date ascending.

The date-range filter on the download dialog stays; if no range is picked it exports everything (matching what you uploaded — July → June).

## Files touched

- New migration: delete Orthodent invoice line items / void invoices, delete entries, project_assignments, projects.
- Data insert (via insert tool, not a migration): recreate 22 projects + project_assignments + 143 time_entries.
- `src/lib/exportClientTimesheet.ts`: rewrite to produce the two-tab format above. No other call sites need changing — `DownloadClientTimesheetDialog` already calls this one function.

## Open question before I run

Confirm the two name matches (Waseem → Waseem Hussain, Saad Akhtar → Saad Akhter). If either is wrong, tell me which profile to use instead.
