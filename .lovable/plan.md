## Re-import Orthodent timesheets

Source: `OrthoDent Total Hours July - June.xlsx`, sheet **Detail Timesheets** (only sheet in the file). 143 rows, 537.5 total hours.

### Name → user mapping (all 5 confirmed in DB)
| Sheet name | Web app user | Hours |
|---|---|---|
| Abdul Rafay | Abdul Rafay | 129.5 |
| Alizar Lalani | Alizar Lalani | 125.5 |
| Saad Akhtar Khan | Saad Akhter Khan | 171.5 |
| Sami | Sami | 12.0 |
| Waseem | Waseem Hussain | 99.0 |

### Column mapping
- A → freelancer name (mapped above)
- B → date (Excel serial → real date, e.g. 45839 = 2025-07-02)
- D → hours
- E → description
- F → project name (22 distinct projects, created under Orthodent client)

### Steps
1. Create the 22 distinct projects under Orthodent client (`53834128-cc80-4789-8031-2f0145d3d814`), `billable_default=true`, `created_by` = Sami (admin).
2. Upsert `project_assignments` for each freelancer ↔ each project they logged on.
3. Insert 143 `time_entries` rows with: `user_id`, `client_id`, `project_id`, `entry_date`, `duration_minutes = hours*60`, `description`, `billable=true`, `status='approved'`, `invoice_id=null`.
4. Verification query: counts per person, per project, total hours = 537.5. Show before confirming done.

No code changes — pure data import via SQL inserts.
