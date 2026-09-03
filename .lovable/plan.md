# Stop dashboard scrolling — open forms as dropdowns

## Problem
Clicking "Start timer" or "Log time manually" on the dashboard opens an inline form card further down the page and programmatically scrolls to it (`scrollIntoView`). This feels like the page "behaves weirdly".

## Fix
Convert both inline form cards into anchored dropdowns (Popovers) that open directly beneath the clicked button — same pattern as the Quick Timer FAB. No scrolling, no page jump.

### Changes (frontend-only, `src/routes/_authenticated.dashboard.tsx`)
1. **Start timer** button → wrap in a `Popover`; the timer form (client select, project select, description, Start button) renders inside `PopoverContent` under the button. Width ~`w-96`, all fields and the Start action stay the same.
2. **Log time manually** button → same treatment: popover with client, project, date, duration, description, Save button.
3. Remove the two `scrollIntoView` effects, the `showFullStart` / `showManual` inline cards, and the now-unused refs (`startFormRef`, `manualFormRef`, etc.).
4. Quick-start chips keep working: they now open the Start-timer popover pre-filled (drive popover `open` state from `handleQuickStart`).
5. New client / New project dialogs stay as-is (they're already modal dialogs).

### Result
Clicking either button shows the form right at the button, page never scrolls. Opening one popover closes the other; saving or starting closes the popover and shows a toast.

## Technical notes
- Reuses existing `@/components/ui/popover` (already imported on this page).
- No database or server-function changes.
- Timesheet "Add entry" button already opens a dialog — unchanged.
