## Fix

The PDF renders each From/To line with a single `drawText` call and no wrapping, so a long address ("Flat no. 101, UBL building, Bahaduryar Jang road, Karachi") spills across the column border into the "To" cell.

Update `src/lib/invoices.functions.ts` `generateInvoicePdf`:

1. Wrap every From/To line with the existing `wrapText` helper at a safe char count for the column width (~54 chars for size-10 Helvetica in a ~256pt cell with 8pt padding), producing a `string[][]` for each side.
2. Compute `boxH` from the total wrapped-line count on the taller side (`max(fromLinesWrapped, toLinesWrapped) * 13 + 16` padding), instead of the raw line count.
3. When drawing, iterate the wrapped lines: bold the first physical line of the first logical line (name/company), regular for the rest. Keep the 13pt line-height and 8pt left padding.
4. Same wrap+height treatment for the Payment Details value column (IBAN can also be long) — wrap at ~40 chars for the 140pt-wide value cell and expand that row's height when it wraps.

No schema, UI, or business-logic changes. Only the PDF layout function.

## QA

Regenerate INV-0002, render with `pdftoppm`, and visually confirm the From address stays inside its column and no text crosses the border.
