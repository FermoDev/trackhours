Plan

Goal: Remove the sticky left navigation pane from the Settings page and simplify the layout to a single column of cards.

Changes

1. Edit `src/routes/_authenticated.settings.tsx`
   - Remove the `<aside>` element that contains the anchor-link navigation (Profile, Password, Account, Admin).
   - Remove the `lg:grid-cols-[220px_minmax(0,1fr)]` grid wrapper and keep the cards in a single column.
   - Remove `id` and `scroll-mt-6` attributes from each `<Card>` since there is no longer any in-page navigation to those anchors.
   - Keep the page title and subtitle at the top.
   - Tighten the single-column width to a more comfortable reading/form width (e.g., `max-w-3xl`) so the page doesn’t stretch on large screens.

No functional changes to profile save, password change, sign out, or admin links.

Out of scope

- No changes to other routes, sidebar, or design tokens.
- No backend or auth changes.