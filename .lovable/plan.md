## Goal
Give freelancers a clear, standalone way to add clients and projects from the Dashboard — not buried inside the timer/manual-entry forms.

Today, the Dashboard already wires `findOrCreateClient` / `findOrCreateProject` and has `+` buttons next to the client/project dropdowns inside the "New project timer" and "Manual entry" cards. But:
- They're invisible until a freelancer opens one of those forms.
- "Add project" is disabled until a client is selected, so it's not discoverable as a top-level action.

## Change

Add a small **"Quick add"** row at the top of the Dashboard (above Quick start / timer card), visible to everyone, with two buttons:

- **+ New client** → opens the existing `addClientOpen` dialog
- **+ New project** → opens the existing `addProjectOpen` dialog, but in a slightly enhanced version that also lets the user pick the client inline (since no client is pre-selected from this entry point)

Behavior:
- Reuses the same `findOrCreateClient` / `findOrCreateProject` server functions (fuzzy match + join-existing confirmation flow already in place).
- After successful creation, refresh `clients` / `projects` lists and toast.
- Newly created/joined client/project is auto-selected in the timer form for convenience (nice-to-have, low cost since state is already there).

## Technical Details

**File:** `src/routes/_authenticated.dashboard.tsx` only. No DB / server-function changes.

1. Add a "Quick add" section (compact card or inline button row) rendered near the top of the page, conditional on `!activeEntry` (or always visible — confirm in question below).
2. Extend the existing **Add project** dialog (`addProjectOpen`) to include a client `<Select>` when `selectedClient` is empty. When opened from the timer card, behavior stays the same (client is preselected and select is hidden/locked).
3. On successful add from the quick-add buttons:
   - Update local `clients` / `projects` state from the server response (or re-run `loadData()`).
   - Auto-select the new client/project in the timer form.
4. No changes to RLS, server functions, or migrations — `findOrCreateProject` already runs under `supabaseAdmin` and handles the freelancer case.

## Out of scope
- A dedicated `/projects` page for freelancers.
- Editing/archiving projects from the freelancer side.
- Admin merge UI changes.

## Question before I implement
Where should the **Quick add** buttons live visually? Options:

```text
A) Compact pill row above "Quick start":
   [ + New client ]  [ + New project ]

B) Inside the Quick start card header (right-aligned), next to "Quick start" label.

C) As a small card to the right of the timer card on desktop, collapses below on mobile.
```

Default if you don't pick: **A** — most discoverable, simplest, no layout reshuffle.