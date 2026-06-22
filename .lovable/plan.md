## Fix: Add Client silently fails

The Add Client dialog in `src/routes/_authenticated.admin.clients.tsx` calls `supabase.from("clients").insert(...)` but **never inspects the result**. On any error (RLS, unique constraint, network) it just closes the dialog and refetches — so you see nothing happen.

### Changes

1. **Surface the real error** in `handleAdd`:
   - Capture `{ error }` from the insert.
   - On error: keep the dialog open and show `toast.error(error.message)` so we can see exactly why it failed (RLS, duplicate name/code, etc.).
   - On success: show `toast.success("Client added")`, then close + refetch.
2. **Reset the adding state in a `finally`** so the button can never get stuck spinning.
3. No schema or RLS changes yet. Once you click Add again and we see the actual error message, we'll know if it's a duplicate-name constraint, an RLS rejection, or something else, and follow up with the right fix.

### Out of scope

- No change to the `clients` table, policies, or the auto-assign trigger.
- No change to the self-serve `findOrCreateClient` flow used elsewhere.
