# Client Revenue (admin only)

A new admin-only Revenue page that shows, per client, how much money the work is worth — based on an hourly rate you set for each client. Freelancers can never see rates or revenue.

## What you get

**New "Revenue" item in the Admin menu** (admins only), between Invoices and Reports.

The page shows:
- Top cards: total earned (all billable hours x client rate), total invoiced, and total not yet invoiced — for the selected date range.
- A table of clients, each row with: client name, hourly rate (editable inline), billable hours, earned amount, invoiced amount, and remaining.
- A simple bar chart of earned revenue by client.
- Date range filter (this month / last month / this year / custom), defaulting to this month.
- Export to CSV.

All amounts in CAD.

**Setting a rate:** each client gets one hourly rate. You set it right on the Revenue page (inline field per client row), and it's also shown when managing clients. Clients without a rate show 0 and are flagged so you can spot them.

**"Earned" vs "Invoiced":**
- Earned = every billable time entry in the range x that client's rate.
- Invoiced = hours in the range that are already attached to an invoice x the rate.
- Remaining = earned minus invoiced.

## Privacy

Rates and revenue are stored separately from the client record and are readable only by admin accounts, enforced at the database level — not just hidden in the interface. A freelancer querying directly gets nothing back. The Revenue page itself is behind the existing admin-only area, and all revenue numbers are computed on the server through an admin-verified call.

## Technical notes

- New table `public.client_rates`: `client_id` (unique, FK to clients), `hourly_rate_cents` bigint, `currency` text default `'CAD'`, timestamps + updated_at trigger. GRANT to `authenticated` and `service_role`; RLS enabled with a single policy `has_role(auth.uid(), 'admin')` for ALL — no anon grant. Kept out of the `clients` table so existing client SELECT policies (which freelancers can use) never expose rates.
- New `src/lib/revenue.functions.ts` with `requireSupabaseAuth` + explicit `has_role(..., 'admin')` check in each handler:
  - `getClientRevenue({ from, to })` — aggregates `time_entries` (billable, non-null duration) grouped by client, splitting invoiced (`invoice_id is not null`) vs not, joins `client_rates`, returns per-client rows and totals.
  - `setClientRate({ clientId, hourlyRate })` — upsert on `client_rates`.
- New route `src/routes/_authenticated.admin.revenue.tsx` (inside existing admin layout guard) using `useServerFn` + react-query, shadcn Card/Table/Select/Input and recharts `BarChart`, matching the Reports page styling. Includes `head()` metadata.
- Sidebar entry added to `adminNav` in `src/components/AppSidebar.tsx` with a `DollarSign` icon (already admin-gated).
- No change to invoicing; the invoice "rate" stays what the freelancer is paid and is unrelated to the client rate.
