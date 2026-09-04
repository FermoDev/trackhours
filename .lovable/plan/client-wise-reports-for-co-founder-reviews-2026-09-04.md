# Client-wise Reports for co-founder reviews

Rebuild the admin Reports page around clients instead of raw filters, so it reads like a business review: how much time each client took, what that's worth, who worked on it, and how it's trending.

## What you'll see

### 1. Period selector (top)
Presets: This month, Last month, This quarter, Year to date, All time, plus custom dates. One control drives the whole page.

### 2. Headline cards
- Total hours in the period
- Total revenue earned (CAD)
- Invoiced vs not-yet-invoiced
- Active clients / number of people who logged time

### 3. All-clients overview
One card per client, sorted by revenue, each showing:
- Hours, revenue earned, invoiced, still to invoice
- Share of total (bar)
- Change vs the previous equal-length period (e.g. +18% vs last month)
- Expand to see the client's projects (hours + revenue) and the people who worked on it
- "View details" opens the deep dive

Clients with no rate set show hours only, with a quiet "no rate set" note and a link to Revenue.

### 4. Trend chart
Month-by-month bars for hours with a revenue line, across the selected period (falls back to last 12 months for short ranges). Toggle between all clients (stacked by client) and a single client.

### 5. Single-client deep dive
Selecting a client shows, for that client only:
- Headline numbers and month-by-month trend
- Project breakdown table (hours, revenue, % of client)
- Person breakdown table (hours, % of client)
- Recent entries list
- Export: CSV of the summary, and a one-click "Copy summary" of plain-text highlights for pasting into a co-founder update

### 6. Export
CSV export respects the current period and reflects what's on screen (client summary, or the deep-dive breakdown), not a raw entry dump. The raw entry dump stays available under Admin → All entries.

## Money visibility
Revenue figures appear only for admins. The page already sits under the admin area; the underlying data is fetched through an admin-verified server call, so a non-admin cannot pull the numbers even directly.

## Technical notes
- New `getReportSummary` server function in `src/lib/revenue.functions.ts` (or a new `src/lib/reports.functions.ts`), using `requireSupabaseAuth` + the existing `ensureAdmin` check, then `supabaseAdmin`. It returns, for a date range: per-client rows (hours, billable/non-billable split, invoiced minutes, earned/invoiced/remaining using `client_rates`), per-client project and per-user breakdowns, monthly buckets, and previous-period totals for the comparison.
- Rewrite `src/routes/_authenticated.admin.reports.tsx` to consume that single call via TanStack Query instead of the current direct `supabase.from(...)` client queries and client-side grouping.
- Deep dive is state on the same route (`?client=<id>` search param) — no new route file.
- Charts use the existing `recharts` setup used on the Revenue page; currency formatting shared with Revenue.
- Rates and revenue math stay owned by the Revenue page; Reports reads them.
