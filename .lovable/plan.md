Add a new **"By Project"** sheet to the client timesheet Excel export (`src/lib/exportClientTimesheet.ts`), inserted right after the Summary sheet and before the per-freelancer sheets.

### Sheet contents

For each project that has entries for this client in the selected range, show:

- **Project name** (header row, bold, larger)
- **Total hours** for the project (and entry count)
- A table of entries under that project:
  - Date
  - Freelancer
  - Hours
  - Description
- Entries sorted by date ascending
- A "Project total" row at the bottom of each project block
- Projects sorted by total hours descending (highest-impact first)
- Below each project: a small "Contributors" line listing each freelancer + their hours on that project (so the client sees at a glance who worked on it)

A grand total row at the bottom of the sheet.

### Layout sketch

```text
Client Name — Project Breakdown
Date range: ...

────────────────────────────────────────────────
Project: BI Dashboard Development          120.50h  (45 entries)
Contributors: Saad 60.0h, Alizar 40.5h, Abdul Rafay 20.0h
  Date        Freelancer       Hours   Description
  2025-08-01  Saad             3.50    ...
  ...
                               ─────
                  Project total 120.50

────────────────────────────────────────────────
Project: Excel automation on EC2            85.00h  (30 entries)
...

────────────────────────────────────────────────
                          GRAND TOTAL  396.00h
```

### Implementation notes

- Group `rows` by `project_id` (use `projects?.name` as label; fallback "—").
- Reuse the existing `profileMap` for freelancer names.
- Column widths: Date 12, Freelancer 24, Hours 10, Description 60.
- Use the same styling tokens already in the file (grey header fill `FFEFEFEF`, thin borders, `0.00` numFmt for hours).
- Sheet name: `"By Project"` (added to `usedNames` set so it doesn't collide).
- No changes to the Summary or per-freelancer sheets, no changes to the download dialog, no DB/schema changes.

### Files touched

- `src/lib/exportClientTimesheet.ts` — add the new worksheet block between the Summary sheet and the per-freelancer loop.
