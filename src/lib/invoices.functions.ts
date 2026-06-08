import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({ invoiceId: z.string().uuid() });

export const generateInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(name, code), invoice_line_items(*)")
      .eq("id", data.invoiceId)
      .eq("user_id", userId)
      .single();
    if (invErr || !invoice) throw new Error("Invoice not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .single();

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // US Letter
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { height, width } = page.getSize();
    const margin = 50;
    let y = height - margin;

    const fmtMoney = (cents: number) =>
      `${invoice.currency} ${(cents / 100).toFixed(2)}`;

    // Header
    page.drawText("INVOICE", { x: margin, y, size: 28, font: bold, color: rgb(0, 0.73, 0.41) });
    page.drawText(`#${invoice.invoice_number}`, { x: width - margin - 120, y, size: 16, font: bold });
    y -= 40;

    // From / To
    page.drawText("From", { x: margin, y, size: 9, font: bold, color: rgb(0.5, 0.5, 0.5) });
    page.drawText("Bill to", { x: width / 2, y, size: 9, font: bold, color: rgb(0.5, 0.5, 0.5) });
    y -= 14;
    page.drawText(profile?.full_name || profile?.email || "", { x: margin, y, size: 11, font });
    page.drawText((invoice.clients as any)?.name || "", { x: width / 2, y, size: 11, font });
    y -= 14;
    if (profile?.email) page.drawText(profile.email, { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 30;

    // Dates
    const drawKV = (label: string, val: string, x: number, yy: number) => {
      page.drawText(label, { x, y: yy, size: 9, font: bold, color: rgb(0.5, 0.5, 0.5) });
      page.drawText(val, { x, y: yy - 13, size: 11, font });
    };
    drawKV("Issue date", invoice.issue_date, margin, y);
    if (invoice.due_date) drawKV("Due date", invoice.due_date, margin + 130, y);
    if (invoice.period_start && invoice.period_end) {
      drawKV("Period", `${invoice.period_start} → ${invoice.period_end}`, margin + 260, y);
    }
    y -= 40;

    // Line items table
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 14;
    page.drawText("Description", { x: margin, y, size: 9, font: bold });
    page.drawText("Hours", { x: width - margin - 200, y, size: 9, font: bold });
    page.drawText("Rate", { x: width - margin - 130, y, size: 9, font: bold });
    page.drawText("Amount", { x: width - margin - 60, y, size: 9, font: bold });
    y -= 8;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 14;

    const items = (invoice.invoice_line_items as any[]) || [];
    items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const item of items) {
      const descLines = wrapText(item.description, 55);
      for (let i = 0; i < descLines.length; i++) {
        page.drawText(descLines[i], { x: margin, y, size: 10, font });
        if (i === 0) {
          page.drawText(Number(item.hours).toFixed(2), { x: width - margin - 200, y, size: 10, font });
          page.drawText(fmtMoney(item.rate_cents), { x: width - margin - 130, y, size: 10, font });
          page.drawText(fmtMoney(item.amount_cents), { x: width - margin - 60, y, size: 10, font });
        }
        y -= 14;
      }
      y -= 4;
    }

    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;
    page.drawText("Total", { x: width - margin - 130, y, size: 12, font: bold });
    page.drawText(fmtMoney(invoice.total_cents), { x: width - margin - 60, y, size: 12, font: bold });
    y -= 30;

    if (invoice.notes) {
      page.drawText("Notes", { x: margin, y, size: 9, font: bold, color: rgb(0.5, 0.5, 0.5) });
      y -= 14;
      for (const line of wrapText(invoice.notes, 80)) {
        page.drawText(line, { x: margin, y, size: 10, font });
        y -= 13;
      }
    }

    await supabase.from("invoices").update({ pdf_generated_at: new Date().toISOString() }).eq("id", data.invoiceId);

    const bytes = await pdf.save();
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return { base64, filename: `invoice-${invoice.invoice_number}.pdf` };
  });

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur ? cur + " " : "") + w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}