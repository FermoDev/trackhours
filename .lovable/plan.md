## Problem

On the dashboard, clicking **New project timer** or **Manual entry** appears to do nothing. The click handlers do set `showFullStart` / `showManual`, and the corresponding cards do render — but they render *below* the "Manage your clients & projects" card, the active-timer card, and other content. On most viewport heights the newly-revealed form is off-screen, so the button looks dead.

## Fix

1. **Reorder the dashboard** so the "Start a new timer" and "Add manual entry" cards render *immediately after* the two action buttons (`New project timer` / `Manual entry`), not after the "Manage your clients & projects" section. That way the form appears right where the user clicked.

2. **Scroll + focus on open**: give each form card a `ref`; when `showFullStart` / `showManual` flips to true, call `ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })` and auto-focus the first empty control (client select if no client picked, otherwise the description textarea). This makes the reveal obvious even on short viewports.

3. **Toggle behaviour**: clicking the same button again while its form is open should close it (currently it re-sets state to the same value, which is a no-op but reads as "still broken"). Flip the handlers to `setShowFullStart(v => !v)` and `setShowManual(v => !v)`, and keep the mutual-exclusion (opening one closes the other).

4. **Verify** by driving the dashboard with Playwright: click each button, screenshot to confirm the form is in-view and focused, and confirm a second click hides it.

No changes to timer logic, server functions, or database — this is a pure UI / layout fix.
