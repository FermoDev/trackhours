The current invoice renders all content near the top of the page (title, From/To, description table, payment details all bunched upward). The user wants the description table pushed down and the overall layout to look like a proper invoice.

## Changes
1. Increase the vertical gap between the From/To block and the Period / Description table.
2. Keep the previously increased spacing between the Total row and the Payment Details block.
3. Verify the PDF still fits within US Letter margins and no elements overlap.

## Scope
- Only edit `src/lib/invoices.functions.ts` (the PDF generation function).
- No database or UI changes.
- No new dependencies.

## QA
- Generate an invoice PDF in the preview at `/admin/invoices`.
- Convert to images and inspect to confirm the description table is lower and the layout is balanced.