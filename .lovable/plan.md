## Reset Orthodent and wait for a fresh import

The previous import was wrong end-to-end. Wipe everything Orthodent again so we can redo it cleanly from a sheet you provide.

### Step 1 — Full Orthodent data wipe
On the Orthodent client (keep the client row + `client_assignments` intact):
- Void any invoices tied to Orthodent (`invoices.status = 'void'`).
- Delete all `invoice_line_items` linked to those invoices.
- Delete all `time_entries` where `client_id = Orthodent`.
- Delete all `project_assignments` for Orthodent projects.
- Delete all `projects` where `client_id = Orthodent`.

After this: 0 projects, 0 entries, 0 assignments under Orthodent.

### Step 2 — Stop and ask before re-importing
I will NOT re-import from the previous file. Instead, once the wipe is done I'll ask you to:
1. Re-upload the Excel sheet (or confirm the existing one is the source of truth).
2. Walk me through which sheet/tab and which columns map to: **freelancer name, date, hours, project, description**.
3. Confirm the exact name→profile mapping (Waseem Hussain, Saad Akhter Khan, and any other ambiguous names) BEFORE any insert runs.

### Step 3 — Re-import (only after your confirmation)
Create projects + insert time entries strictly per your column mapping and name mapping. Then I'll show you a verification query (counts per project, counts per person, total hours) for you to sign off before we touch anything else.

### Excel export format
No changes this round — the two-tab export format stays as-is unless you tell me it's also wrong.

### Open question
Do you want me to keep the existing uploaded sheet `OrthoDent_Total_Hours_July_-_June.xlsx` as the source, or will you upload a new/corrected one after the wipe?
