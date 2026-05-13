## Problem

Two issues on the Dashboard quick-add flow:

1. **Bug — modal never closes, no feedback.** When `findOrCreateClient` / `findOrCreateProject` throws (e.g. session expired → 401 from `requireSupabaseAuth`, network blip, or any runtime error), the handler has no `try/catch`. Result:
   - `setSavingClient(false)` / `setSavingProject(false)` never runs → button stuck on "Saving…"
   - Dialog stays open
   - No toast — user has no idea what happened
   Server logs confirm recent `POST /_serverFn → 401` failures.

2. **Description field is not mandatory** on the client/project create dialogs. User wants it required for both, matching how the timer / manual entry already require a description.

## Changes

### 1. `src/server/clients.functions.ts`
- Add an optional `description` field to the `findOrCreateClient` and `findOrCreateProject` input validators (trimmed, max 500).
- Persist it on **create** (not on join — joining an existing one shouldn't overwrite the original description).
- For `findOrCreateProject`: already has a `description` column on `projects` (nullable) — just write it on create.
- For `findOrCreateClient`: `clients` table has **no `description` column** today → add it via a new migration (see #3).
- Wrap the unique-violation retry path the same way (no description on join).

### 2. `src/routes/_authenticated.dashboard.tsx`
- **Wrap both handlers in `try/catch/finally`** so `savingClient` / `savingProject` always resets and a toast is shown on failure:
  ```ts
  try {
    const result = await findOrCreateClientFn({ data: {...} });
    // ...existing success/needs_confirmation logic
  } catch (err) {
    console.error("Add client failed:", err);
    toast.error(err instanceof Error ? err.message : "Failed to add client");
  } finally {
    setSavingClient(false);
  }
  ```
- Add a **required** `Description` textarea to the Add Client dialog (new `newClientDescription` state).
- Add a **required** `Description` textarea to the Add Project dialog (new `newProjectDescription` state).
- Disable the "Add" button until description is non-empty.
- Pass description into the server-fn call.
- Reset both description fields on success / on dialog close.
- Also reset `savingClient`/`savingProject` when the dialog is dismissed via the X / overlay (`onOpenChange`), in case anything else ever leaves them stuck.

### 3. New migration: add `description` to `clients`
```sql
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS description text;
```
Nullable at the DB level (existing rows have no description; admins may not need it). Mandatory enforcement happens at the form + server-fn validation layer for new freelancer-created clients.

### 4. (Optional, in scope) Surface description on existing admin client list
Skip — out of scope for this fix. Can be added later if you want to view/edit it from the admin Clients page.

## Out of scope
- Backfilling descriptions on existing clients
- Editing description after creation
- Showing description anywhere else in the UI

## Why the 401 happens (not fixed here, just noted)
Likely the user's Supabase session expired in that tab. The fix above makes the failure **visible** (toast + recovered dialog) instead of silently hanging. If 401s keep recurring we can add an auto-refresh / re-auth prompt as a follow-up.
