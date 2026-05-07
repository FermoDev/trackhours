## Per-Client Timesheet Excel Export

Add a "Download timesheet" action on each row of **Admin → Clients**. It opens a small dialog to pick a date range (with quick presets), then generates a formatted `.xlsx` workbook scoped to that client.

### UX flow

On `/admin/clients`, each client row gets a new **Download** icon button. Clicking it opens a dialog:

- **Date range presets**: This month · Last month · This week · All time · Custom range
- Custom range reveals two date inputs (from / to)
- Primary button: **Download Excel** → triggers file download, closes dialog

### Workbook structure

File name: `{ClientName}_Timesheet_{from}_to_{to}.xlsx`

**Sheet 1 — "Summary"**
| Freelancer | Project(s) | Entries | Total Hours |
|---|---|---|---|
| Jane Doe | Website, Branding | 12 | 34.5 |
| ... | | | |
| **Grand total** | | **47** | **128.0** |

Header row bold, hours right-aligned, totals row bold with top border. Includes a header block above the table with: Client name, Date range, Generated on, Total hours.

**Sheets 2…N — one per freelancer** (sheet name = freelancer name, truncated to Excel's 31-char limit, deduped if collisions)
| Date | Project | Hours | Description |
|---|---|---|---|
| 2026-05-01 | Website | 2.5 | Homepage hero section |
| ... | | | |
| | | **Total: 34.5** | |

Sorted by date ascending. Hours shown as decimal hours (consistent with rest of app — minutes ÷ 60, 2 decimals). Description column wraps text, wider column.

### Technical implementation

**New library**: `bun add exceljs` (works in browser, supports formatting/styling, lightweight enough for client-side generation).

**New file**: `src/lib/exportClientTimesheet.ts`
- Function `exportClientTimesheet({ clientId, clientName, from, to })`
- Queries `time_entries` filtered by `client_id`, optional date range, joins `projects(name)` and `profiles(full_name, email)` (via two queries: entries + profile lookup map, since there's no FK relationship)
- Groups entries by `user_id`
- Builds workbook with ExcelJS, applies styles, triggers browser download via Blob

**New component**: `src/components/DownloadClientTimesheetDialog.tsx`
- Dialog with preset radio group + custom date inputs
- Calls the export function, shows loading state, toast on success/error

**Edited**: `src/routes/_authenticated.admin.clients.tsx`
- Add Download icon button per client row, opens the dialog with that client's id+name

### Out of scope

- No backend/server function — query runs client-side using the existing admin Supabase session (admins already have full read access to `time_entries` via RLS)
- No changes to existing Reports CSV export
- No PDF version (Excel only, as requested)
- No email/share — file downloads to user's machine
