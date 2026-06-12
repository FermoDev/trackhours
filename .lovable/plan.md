## Source verified
Sheet `Timesheets` in `Jul_-_Apr_total.xlsx`, 120 rows total:
- Saad → 162h, Abdul Rafay → 117.5h, Alizar → 117.5h, Waseem → 99h
- All entries: client = OrthoDent, billable = true, invoice_id = null
- `duration_minutes = round(hours * 60)`, `start_time`/`end_time` = null

## User mapping
| Sheet name | profiles.user_id |
| --- | --- |
| Saad | Saad Akhter Khan |
| Abdul Rafay | Abdul Rafay |
| Alizar | Alizar Lalani |
| Waseem | Waseem Hussain |

## Keyword → project mapping (case-insensitive, first match wins)

| Order | Keywords (any match) | Project |
| --- | --- | --- |
| 1 | `claude`, `datalake` | Claude Connector for Datalake |
| 2 | `ec2`, `aws`, `lambda`, `glue`, `terraform`, `rds`, `etl`, `pipeline`, `sharepoint`, `power automate`, `athena`, `dynamodb`, `eventbridge`, `s3`, `cloudwatch`, `automation`, `active campaign`, `ac import` | Excel file automation on EC2 |
| 3 | `payment allocation`, `ar sub`, `ar stand`, `ar activities`, `ar ledger`, `ar logic`, `late fee`, `duplicate payment`, `customer transaction`, `invoice` | Dashboard Creation /Updation |
| 4 | `tracker`, `dashboard`, `warehouse`, `semantic model`, `transaction detail`, `adhoc`, `reporting`, `sql quer`, `data download`, `refresh`, `customer activity`, `ortho customer` | BI Dashboard Development |
| 5 | fallback (`project discussion`, `follow-up`, `meeting`, etc.) | Project Management |

## Execution
1. Build the 120-row INSERT locally with the mapping above, plus assignment upserts for `client_assignments` (OrthoDent → 4 users) and `project_assignments` (each user → each project they have entries in).
2. Run via the data-insert tool as one transaction:
   - `INSERT INTO time_entries (user_id, client_id, project_id, entry_date, duration_minutes, description, billable) VALUES …` (120 rows)
   - `INSERT INTO client_assignments … ON CONFLICT DO NOTHING`
   - `INSERT INTO project_assignments … ON CONFLICT DO NOTHING`
3. Verify with `SELECT full_name, SUM(duration_minutes)/60.0 FROM time_entries JOIN profiles USING (user_id) WHERE client_id = '<OrthoDent>' AND entry_date BETWEEN '2025-06-25' AND '2026-04-30' GROUP BY full_name` and confirm 162 / 117.5 / 117.5 / 99.

## Note
No code changes — data import only. Nothing is invoiced; all 120 entries remain billable and available for inclusion in the next OrthoDent invoice.
