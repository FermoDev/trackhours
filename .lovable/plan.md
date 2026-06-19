# Visual Polish Plan

A cohesive design refresh inspired by Notion / Height — warm surfaces, soft depth, rounded corners — with a floating sidebar and full-bleed page layouts. No business logic changes.

## 1. Design tokens (`src/styles.css`)

Warm up the neutrals and add depth tokens:

- Background: shift from cool blue-grey to a warm off-white (`oklch(0.985 0.004 80)` light / warmer dark surface).
- Cards: pure white in light, slightly elevated charcoal in dark.
- Borders: softer, lower contrast.
- Add `--shadow-soft`, `--shadow-card`, `--shadow-float` (sidebar) tokens.
- Bump base `--radius` from `0.75rem` to `0.875rem` for rounder feel.
- Keep the green primary `#00ba6a` — it stays the single accent.

## 2. Sidebar — floating card (`AppSidebar.tsx`)

Convert the full-height bordered rail into an inset floating panel:

- Wrap in outer padding (`p-2 md:p-3`) so the sidebar sits **inside** the page background with margin around it.
- Sidebar itself: `rounded-2xl`, `shadow-card`, `bg-card`, no right border.
- Section grouping with small uppercase labels: **Work** (Dashboard, Timesheet, Invoices), **Admin** (admin items, admin only), **Account** (Settings).
- Nav items: refined typography, slightly tighter, active state uses a soft tinted pill (`bg-primary/10 text-primary`) instead of the current accent fill.
- Footer (user + sign out): cleaner avatar circle with initials, name + email stacked, sign-out as ghost icon button.
- Mobile: same floating treatment, slides in from left.

## 3. Layout shell (`_authenticated.tsx`)

- Page background becomes the warm tone; sidebar floats on top of it.
- Replace `max-w-7xl mx-auto` with `w-full` + responsive horizontal padding so pages go full-bleed.
- Top spacing for sticky timer bar preserved.

## 4. Settings page (`_authenticated.settings.tsx`)

Currently `max-w-lg` pinned left — looks unbalanced on wide screens. Rework:

- Two-column on `lg+`: left rail with section nav (Profile, Password, Account, Admin links) that smooth-scrolls; right column holds the cards.
- Cards get `rounded-2xl`, soft shadow, more generous padding, section icons in header.
- On mobile: single column, stacked cards full-width.
- Inputs: slightly taller, rounded-lg, subtle focus ring in primary.

## 5. Card + Button polish (light touch, app-wide)

- `Card`: default to `rounded-2xl`, `border-border/60`, `shadow-soft`.
- `Button`: default radius bumped to `rounded-lg`; keep existing variants. Primary uses a very subtle gradient (primary → slightly lighter) for warmth.
- Page headers across routes: standardize a `PageHeader` look (h1 + muted subtitle, consistent spacing) — applied inline where headers already exist (Dashboard, Timesheet, Invoices, Admin pages, Settings). No new component required; just consistent classes.

## 6. Sticky timer + Quick Timer FAB

- Sticky timer bar: rounded-bottom, soft shadow, sits flush with floating sidebar.
- FAB: larger, softer shadow, primary gradient, hover scale.

## Out of scope
- No route/feature changes, no data model changes, no copy rewrites.
- Existing color semantics (success/warning/destructive) unchanged.
- Dark mode tokens updated to match but theme toggle behavior unchanged.

## Files touched
- `src/styles.css` — tokens, shadows, radius, warm neutrals
- `src/components/AppSidebar.tsx` — floating card + grouped sections
- `src/routes/_authenticated.tsx` — shell padding + full-bleed container
- `src/routes/_authenticated.settings.tsx` — two-column layout
- `src/components/ui/card.tsx`, `src/components/ui/button.tsx` — defaults polish
- `src/components/StickyTimer.tsx`, `src/components/QuickTimerFab.tsx` — shadow + radius polish
- Light className tweaks on page headers in dashboard / timesheet / invoices / admin routes for consistency
