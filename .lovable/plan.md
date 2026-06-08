## 1. Remove manager role & Team Overview

**DB migration**
- Demote any users with role `manager` → `freelancer` in `user_roles`.
- Leave the `app_role` enum value `'manager'` in place (Postgres can't easily drop enum values without rewriting dependent objects). It just won't be assigned anywhere.

**Code deletions**
- `src/routes/_authenticated.manager.tsx`
- `src/routes/_authenticated.manager.index.tsx`
- `src/server/manager.functions.ts`
- Remove `managerNav` and the `isManager` branch in `src/components/AppSidebar.tsx`.
- Remove "Manager" option from the role dropdown in `src/routes/_authenticated.admin.users.tsx`.
- Drop any `role === 'manager'` checks in `src/lib/auth.tsx` and routes.

## 2. Merge Timesheet + Weekly View

- Keep `/timesheet` as the single route. Add a view toggle (List ↔ Week) at the top.
- Move the existing weekly-grid UI from `_authenticated.weekly.tsx` into a `<WeeklyView />` component rendered when the toggle is "Week".
- Delete `_authenticated.weekly.tsx` and the sidebar entry for it.

## 3. Quick-add timer FAB (floating button, any page)

- New `<QuickTimerFab />` component mounted in `_authenticated.tsx` (authenticated layout only).
- Floating bottom-right button → opens a small popover with Client/Project selectors + optional description → starts a timer via existing `useTimer` hook.
- Hidden while a timer is already running (the sticky bar already covers that case).

## 4. Invoicing / PDF export

**DB migration** — new `invoices` table:
- `id`, `user_id` (owner), `client_id`, `invoice_number` (auto per-user sequence), `issue_date`, `due_date`, `status` (draft/sent/paid), `subtotal_cents`, `total_cents`, `notes`, `pdf_generated_at`.
- `invoice_line_items`: `id`, `invoice_id`, `description`, `hours`, `rate_cents`, `amount_cents`, optional `time_entry_ids[]` for traceability.
- RLS: owner can CRUD their own; admins can view all. GRANTs to authenticated + service_role.

**UI**
- New route `/invoices` (freelancer) → list of invoices with status badges.
- "New invoice" flow: pick client → pick date range → app pulls billable, un-invoiced `time_entries` for that client → preview line items grouped by project → save as draft.
- Mark sent / mark paid actions.
- "Download PDF" button → calls a `generateInvoicePdf` server fn (using `pdf-lib` — Worker-safe) that returns a base64 PDF; client triggers download.
- Once an invoice is created, its source `time_entries` get `invoice_id` set (new nullable column) so they don't show up in future invoice drafts.

**Sidebar**
- Add "Invoices" entry under freelancer nav, between Weekly/Timesheet and Settings.

## 5. Order of operations

1. Migration: demote managers + add `invoices` tables + `time_entries.invoice_id`.
2. Remove manager code & Team Overview route.
3. Merge Timesheet/Weekly.
4. Add QuickTimer FAB.
5. Build invoicing UI + PDF server fn.

I'll knock these out in that order. Approve and I'll start with the migration.