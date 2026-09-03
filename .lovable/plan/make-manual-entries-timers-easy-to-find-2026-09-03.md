# Make manual entries & timers easy to find

## Problem
Users can't find where to log time. On the dashboard, "New project timer" and "Manual entry" are small grey outline buttons buried below the stat cards, and the forms they open render further down the page. The Timesheet page (where users naturally look for their hours) has no way to add an entry in list view — only the Week view has small "+" cells.

## Changes

### 1. Dashboard — prominent primary actions
- Replace the two small outline buttons with two large, high-contrast buttons placed right under the "Welcome" header (above the stats cards):
  - **Start timer** (primary green button, Play icon)
  - **Log time manually** (secondary/outline but same size, Plus icon)
- Rename "New project timer" → "Start timer" and "Manual entry" → "Log time manually" so the wording matches what users look for.
- Keep the existing inline forms and scroll/focus behavior — they just open from these prominent buttons now.
- Move the "New client / New project" buttons into the same row as smaller actions so all creation actions live in one visible place.

### 2. Timesheet page — "Add entry" button in the header
- Add a green **Add entry** button next to the List/Week toggle in the Timesheet header.
- Opens a dialog with client, project, date, duration (hours/minutes), and description — same fields as the dashboard manual form, same insert logic.
- Available in both List and Week views, so users can add time from wherever they are.
- After saving, the entry list/week grid refreshes and a success toast confirms.

### 3. Week view hint
- Add a short helper line above the weekly grid: "Click any day cell to add time" so the existing click-to-add behavior is discoverable.

## Technical notes
- All changes are frontend-only: `src/routes/_authenticated.dashboard.tsx`, `src/routes/_authenticated.timesheet.tsx`, and a small shared manual-entry dialog component (`src/components/AddEntryDialog.tsx`) reused by both pages to avoid duplicate logic.
- No database or RLS changes needed — inserts use the existing `time_entries` path.
- Quick-timer FAB stays as-is.
