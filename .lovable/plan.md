## 1. Fuzzy match on self-serve client/project creation

Today `findOrCreateClient` / `findOrCreateProject` only match **exact** (case-insensitive) names. So "Orthodent" vs "Ortho dent" vs "Orthdent" create duplicates that an admin then has to merge.

### Approach
Enable Postgres `pg_trgm` extension and add a trigram similarity check inside the existing server functions.

**Server function flow (both client + project):**

```
input: "Orth dent"
  ├─ exact ilike match? → join silently (existing behavior)
  ├─ no exact, but similarity ≥ 0.85 → return { needsConfirmation: true, suggestion: { id, name } }
  └─ no match at all → create new
```

The client (Dashboard) reacts to `needsConfirmation` by opening a small confirm dialog:

```
We found a similar client: "Orthodent"
Did you mean this one?
  [Use existing Orthodent]   [Create new "Orth dent"]
```

If the user picks "Use existing" → call the same server fn again with `force: "use", id: <suggestionId>`.
If the user picks "Create new" → call again with `force: "create"`.

This avoids silently merging "Acme" into "Acme Inc" (which would be wrong) while still catching genuine typos. Threshold of 0.85 catches 1–2 character typos and minor word-order/spacing differences but rejects truly different names.

**Auto-assign on confirm**: when the user picks the existing record, the server fn inserts the `client_assignments` (and for projects, `project_assignments`) row exactly like today, so the user immediately sees it.

### Files

- **Migration**: enable `pg_trgm`, add GIN trigram indexes on `clients(name)` and `projects(name)` (per client) for fast similarity lookup.
- **`src/server/clients.functions.ts`**: extend `findOrCreateClient` and `findOrCreateProject` input schema with optional `force: "use" | "create"` + `forceId`. Add similarity query. Return discriminated union `{ success, status: "joined" | "created" | "needs_confirmation", id?, name?, suggestion? }`.
- **`src/routes/_authenticated.dashboard.tsx`**: handle `status === "needs_confirmation"` by opening a small `AlertDialog` confirm. On confirm, re-call the server fn with `force`.

## 2. Mandatory description

### Timer start
- Add a description `Textarea` to the "New project timer" card and to the Quick-start path.
- Disable the **Start Timer** button until `description.trim().length > 0`.
- For Quick-start buttons, change behavior: clicking a quick-start chip opens the Start dialog pre-filled with that client/project, so the user is forced through the same description input rather than starting blind.
- Pass `description` into `startTimer()` (the hook already supports it).

### Manual entry
- The Manual entry card already has a description input — make it required: disable **Add entry** until non-empty.
- Show a small "Required" hint under the field.

### No DB enforcement
We keep `time_entries.description` nullable in the schema (admin-edited rows, legacy data). Validation lives in the form layer. If you'd prefer hard DB enforcement, say so and we can add a `CHECK (description IS NOT NULL AND length(trim(description)) > 0)` for rows where `user_id = auth.uid()` via a trigger (not a check constraint, since it's user-scoped).

## 3. Desktop notification when timer runs > 2h ("Are you still working?")

### Approach
Use the browser **Notifications API** + an in-tab interval inside `use-timer.tsx`. No service worker needed — notifications fire as long as any tab of the app is open (Chrome shows them even when tab is in background).

**Flow:**

```
startTimer()
  ├─ if Notification.permission === "default" → request once
  └─ store reminder schedule

every 60s (while activeEntry && !isPaused):
  if elapsed >= 2h and no reminder fired yet → fire notification
  else if elapsed >= last_reminder + 1h → fire follow-up
```

**Notification content:**
> ⏱ Still tracking time?
> Your timer for "{project} · {client}" has been running for 2h 15m.
> Click to open and stop it if you're done.

Clicking the notification focuses the app tab (`window.focus()`).

**In-app fallback** (in case the user blocked notifications): after 2h, the sticky timer bar turns amber and shows an inline "Still working? · Stop" prompt. This guarantees the warning is visible even without OS permission.

### Files
- **`src/hooks/use-timer.tsx`**: 
  - Add `useEffect` that runs a 60s interval while `activeEntry && !isPaused`.
  - Track `lastReminderAt` in a ref.
  - Helper `requestNotificationPermission()` called on first `startTimer`.
  - Helper `fireIdleReminder(elapsedSec)` that creates `new Notification(...)`.
- **`src/components/StickyTimer.tsx`**: when `elapsed >= 7200`, switch background to `bg-warning` (or amber tint) and add subtle text "Still working?". Purely visual.
- **`src/lib/idle-reminder.ts`** (new, small): pure helpers — `shouldRemind(elapsed, lastRemindedAt)` and `notify(title, body)` — kept separate so we can unit-test the timing logic.

### Configuration
Constants exposed at the top of the helper:
- `FIRST_REMINDER_AFTER = 2 * 3600` (2h)
- `REPEAT_REMINDER_EVERY = 1 * 3600` (1h)

Easy to tune later or expose in Settings if requested.

## Out of scope (ask before adding)

- **Auto-stop the timer** at, say, 12h. Some freelancers legitimately leave it running across breaks; killing it silently risks data loss. Easy to add later.
- **Per-user notification preference toggle** in Settings. Can add if you want it.
- **Email reminder** if browser notifications aren't granted. More infra; do later if needed.

## Summary of file changes

```
supabase/migrations/<timestamp>_pg_trgm_fuzzy_match.sql   (new)
src/server/clients.functions.ts                          (edit: similarity + force)
src/routes/_authenticated.dashboard.tsx                  (edit: confirm dialog, required description, quick-start opens dialog)
src/hooks/use-timer.tsx                                  (edit: idle reminder interval + permission)
src/components/StickyTimer.tsx                           (edit: warning state at 2h+)
src/lib/idle-reminder.ts                                 (new: helpers)
```

No changes to admin pages, RLS, or existing CSV/Excel exports.
