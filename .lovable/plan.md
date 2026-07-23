## Goal

Replace the current freelancer-facing invoicing with an **admin-only** flow that generates one invoice PDF per freelancer, per client, over a chosen date range, using the uploaded Fermo template as the layout.

## Template summary (from upload)

- **Bill To** is fixed: Fermo Technologies (hardcoded in PDF).
- **Bill From** = the freelancer (name, address, email, phone).
- Header: Invoice No + Due date.
- Single Description row + Total.
- Payment Details block: Account title, Bank, IBAN, SWIFT.

## Answers baked in

- Existing `/invoices` freelancer flow → replaced entirely.
- Bill-to = Fermo Technologies (from template).
- Rate = admin enters per invoice (flat hourly, single currency).
- Period = free date range (from/to dates).
- Line items: **one row per project**, format `ProjectName — Xh @ $Y = $Z` (matches the template's single-description cell by stacking one line per project inside it). Total row underneath.
- Entries pulled: all billable, un-invoiced `time_entries` for that user+client in the range (existing behavior).

## Schema changes

Add to `profiles` (freelancer bill-from + payment info; editable by the user in Settings and by admins):
- `address text`, `phone text`
- `bank_account_title text`, `bank_name text`, `iban text`, `swift_code text`

No other schema changes — the existing `invoices` / `invoice_line_items` / `time_entries.invoice_id` tables already support per-user, per-client invoices. RLS updated so admins can create/read/update invoices for any user.

## Backend

- New `src/lib/admin-invoices.functions.ts`:
  - `previewAdminInvoice({ userId, clientId, from, to, rate })` → grouped-by-project preview (hours, amount) using `supabaseAdmin` after `has_role('admin')` check.
  - `createAdminInvoice(...)` → inserts `invoices` (with `user_id` = target freelancer), line items, stamps `invoice_id` on the source entries.
- Rewrite `src/lib/invoices.functions.ts` `generateInvoicePdf` to render the Fermo layout: header (Invoice No / Due date), From/To two-column block, Description/Amount table with one row per project + Total, Payment Details block. Pulls freelancer info from their `profiles` row.

## UI

- Delete freelancer routes: `_authenticated.invoices.tsx`, `_authenticated.invoices.new.tsx`, `_authenticated.invoices.$id.tsx`. Remove Invoices from freelancer sidebar.
- New admin routes under `_authenticated/admin/`:
  - `admin.invoices.tsx` — list of all generated invoices (freelancer, client, period, total, PDF).
  - `admin.invoices.new.tsx` — form: User select → Client select (limited to clients that user has billable un-invoiced hours for) → From/To dates → Rate → Currency → Invoice #/Due date → Preview table (per-project hours) → Create → auto-download PDF.
  - `admin.invoices.$id.tsx` — view/download an existing invoice.
- Add "Invoices" to the Admin sidebar section.
- Extend `_authenticated.settings.tsx` with a "Billing info" card so freelancers can fill in their address, phone, and bank details (used as From block on invoices).

## Migration order

1. Add profile columns + RLS updates for admin invoice access.
2. Ship server fns + PDF rewrite + admin UI + settings extension in the same build.
3. Delete freelancer invoice routes.

## Open item

The template shows a single "Description" cell. I'll render each project on its own line inside that cell (`Project Management — 42.5h @ $50 = $2,125.00`) plus a bold Total row — closest match to the template while still itemizing per project. Say the word if you'd rather have one flat description ("Services rendered Feb–Jun 2026") with just the grand total.