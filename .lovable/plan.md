## Changes

### 1. Auto invoice numbers (INV-0001, global sequence)
- Add Postgres sequence `invoice_number_seq` and a helper `next_invoice_number()` returning `INV-` + zero-padded 4-digit counter (widens automatically past 9999).
- Seed sequence from current max existing invoice number.
- Remove the invoice number input from `admin.invoices.new.tsx`. `createAdminInvoice` in `src/lib/admin-invoices.functions.ts` calls `next_invoice_number()` instead of accepting one from the client.

### 2. AI-generated description summary
- Ensure `LOVABLE_API_KEY` exists (`ai_gateway--create`).
- New `src/lib/ai-gateway.server.ts` provider helper (Lovable AI Gateway, `openai/gpt-5.5`).
- New server fn `summarizeInvoiceWork({ userId, clientId, from, to })` in `src/lib/admin-invoices.functions.ts`: admin-only, pulls the freelancer's entry descriptions + project names in range, asks the model for a single professional one-line summary of the work performed. Falls back to `Professional services rendered for {Client} ({period})` if the model call fails or descriptions are empty.
- `admin.invoices.new.tsx`: after the user picks freelancer/client/dates, auto-generate the summary into a textarea the admin can edit. "Regenerate" button re-runs the server fn. The final edited string is passed to `createAdminInvoice` as `description`.
- `createAdminInvoice` accepts a required `description` string and stores it as a single invoice line item (`description = <summary>`, `amount_cents = subtotal`). Hours/rate are still used server-side to compute the total, and still saved on the invoice record (`subtotal_cents`, `total_cents`), but not written into any line item description.

### 3. PDF: hide hours and rate
- `src/lib/invoices.functions.ts` `generateInvoicePdf`: the Description/Amount table renders exactly one row — the invoice's summary description and the total amount — followed by the existing Total row. No per-project hour/rate lines. Everything else (From/To, Payment Details, Invoice No, Due date) stays.

### 4. Cleanup
- Drop the invoice-number field from the new-invoice form and its validation.
- Preview step still shows per-project hours to the admin (internal calculation aid), but marked "for your reference — not shown on invoice".

## Technical notes

- Migration: `CREATE SEQUENCE public.invoice_number_seq;` + `SELECT setval(...)` from existing max + `CREATE FUNCTION public.next_invoice_number() ... SECURITY DEFINER SET search_path = ''`. Grant execute to `authenticated`.
- AI call uses `generateText` with a short system prompt ("Write one concise professional invoice description line summarizing this freelance work. No pricing, no hours, no bullet points.") and the concatenated `project_name: description` list as user content.
- Description column on `invoice_line_items` is already `text`; no schema change needed for storing the summary.
- Admin form state: add `description` (string) + `descriptionLoading` (bool); auto-fetch when preview is loaded, allow manual edit + regenerate.
