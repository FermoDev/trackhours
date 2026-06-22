## Root cause: `<Toaster />` is never mounted

`src/components/ui/sonner.tsx` exports a `Toaster` but nothing in the app actually renders it. Every `toast.success` / `toast.error` call (including the one I just added to the Add Client handler) goes into the void — that's why you see "no error, nothing happens": the insert IS failing, but the error toast has nowhere to render.

### Fix

1. **Mount `<Toaster />` in `src/routes/__root.tsx`** alongside the existing layout shell so toasts appear globally on every authenticated and public route.
   - Import `Toaster` from `@/components/ui/sonner`.
   - Render it once inside the root `<body>`/layout so a single instance serves the whole app.
2. After that, click Add again. The real Supabase error message (likely a unique-constraint violation on `code` or a similar issue) will appear as a toast, and we'll know exactly what to address next.

### Out of scope

- No change to the `clients` insert logic itself (already returns and toasts on error after the previous patch).
- No RLS/policy changes yet — confirmed your role is `admin`, so the INSERT policy permits it; we need the visible error before changing anything else.
