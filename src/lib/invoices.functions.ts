import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({ invoiceId: z.string().uuid() });

export const generateInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admin can generate any invoice; others only their own.
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });

    let q = supabase
      .from("invoices")
      .select("*, clients(name), invoice_line_items(*)")
      .eq("id", data.invoiceId);
    if (!isAdmin) q = q.eq("user_id", userId);
    const { data: invoice, error: invErr } = await q.single();
    if (invErr || !invoice) throw new Error("Invoice not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, address, phone, bank_account_title, bank_name, iban, swift_code")
      .eq("user_id", invoice.user_id)
      .single();

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // US Letter
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { height, width } = page.getSize();
    const margin = 50;
    let y = height - margin;
    const contentWidth = width - margin * 2;
    const grey = rgb(0.55, 0.55, 0.55);
    const border = rgb(0.82, 0.82, 0.82);
    const headerBg = rgb(0.96, 0.96, 0.96);

    const fmtMoney = (cents: number) =>
      `${invoice.currency} ${(cents / 100).toFixed(2)}`;

    const drawText = (t: string, x: number, yy: number, opts?: { size?: number; font?: any; color?: any }) =>
      page.drawText(t || "", { x, y: yy, size: opts?.size ?? 10, font: opts?.font ?? font, color: opts?.color });

    const drawRect = (x: number, yy: number, w: number, h: number, fill?: any) =>
      page.drawRectangle({ x, y: yy - h, width: w, height: h, borderColor: border, borderWidth: 0.6, color: fill });

    // Title
    page.drawText("INVOICE", { x: margin, y, size: 24, font: bold });
    y -= 30;

    // Invoice No / Due date header table (2 cols)
    const col = contentWidth / 2;
    drawRect(margin, y, col, 22, headerBg);
    drawRect(margin + col, y, col, 22, headerBg);
    drawText("Invoice No", margin + 8, y - 15, { font: bold, size: 10 });
    drawText("Invoice due", margin + col + 8, y - 15, { font: bold, size: 10 });
    y -= 22;
    drawRect(margin, y, col, 22);
    drawRect(margin + col, y, col, 22);
    drawText(invoice.invoice_number, margin + 8, y - 15);
    drawText(invoice.due_date || "—", margin + col + 8, y - 15);
    y -= 32;

    // From / To (wrap each logical line so long addresses don't spill into the next column)
    const rawFrom = [
      profile?.full_name || "",
      profile?.address || "",
      profile?.email ? `Email: ${profile.email}` : "",
      profile?.phone ? `Phone: ${profile.phone}` : "",
    ].filter(Boolean);
    const rawTo = [
      "Fermo Technologies",
      "1971, Shannon Drive, Mississauga, Ontario,",
      "Canada, L5H3Z6",
      "Email: billing@fermo.io",
      "Phone: +1 (416) 8317292",
    ];
    const COL_WRAP = 54; // safe char count for size-10 Helvetica in ~256pt column with 8pt padding
    const fromWrapped: string[][] = rawFrom.map((l) => wrapText(l, COL_WRAP));
    const toWrapped: string[][] = rawTo.map((l) => wrapText(l, COL_WRAP));
    const fromCount = fromWrapped.reduce((s, a) => s + a.length, 0);
    const toCount = toWrapped.reduce((s, a) => s + a.length, 0);
    const boxH = Math.max(fromCount, toCount) * 13 + 22;
    drawRect(margin, y, col, 22, headerBg);
    drawRect(margin + col, y, col, 22, headerBg);
    drawText("From", margin + 8, y - 15, { font: bold, size: 10 });
    drawText("To", margin + col + 8, y - 15, { font: bold, size: 10 });
    y -= 22;
    drawRect(margin, y, col, boxH);
    drawRect(margin + col, y, col, boxH);
    let fy = y - 15;
    fromWrapped.forEach((lines, i) => {
      lines.forEach((ln) => {
        drawText(ln, margin + 8, fy, { font: i === 0 ? bold : font });
        fy -= 13;
      });
    });
    let ty = y - 15;
    toWrapped.forEach((lines, i) => {
      lines.forEach((ln) => {
        drawText(ln, margin + col + 8, ty, { font: i === 0 ? bold : font });
        ty -= 13;
      });
    });
    y -= boxH + 16;

    // Period line (optional context)
    if (invoice.period_start && invoice.period_end) {
      drawText(`Period: ${invoice.period_start} to ${invoice.period_end}`, margin, y, { color: grey, size: 10 });
      y -= 18;
    }

    // Description / Amount table
    const amtCol = 140;
    const descCol = contentWidth - amtCol;
    drawRect(margin, y, descCol, 22, headerBg);
    drawRect(margin + descCol, y, amtCol, 22, headerBg);
    drawText("Description", margin + 8, y - 15, { font: bold, size: 10 });
    drawText("Amount", margin + descCol + 8, y - 15, { font: bold, size: 10 });
    y -= 22;

    const items = ((invoice.invoice_line_items as any[]) || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const item of items) {
      const lines = wrapText(item.description, 60);
      const rowH = Math.max(20, lines.length * 13 + 6);
      drawRect(margin, y, descCol, rowH);
      drawRect(margin + descCol, y, amtCol, rowH);
      let ly = y - 14;
      for (const line of lines) { drawText(line, margin + 8, ly); ly -= 13; }
      drawText(fmtMoney(item.amount_cents), margin + descCol + 8, y - 14);
      y -= rowH;
    }

    // Total row
    const totalH = 24;
    drawRect(margin, y, descCol, totalH, headerBg);
    drawRect(margin + descCol, y, amtCol, totalH, headerBg);
    drawText("Total:", margin + 8, y - 16, { font: bold, size: 11 });
    drawText(fmtMoney(invoice.total_cents), margin + descCol + 8, y - 16, { font: bold, size: 11 });
    y -= totalH + 150;

    // Payment Details
    drawText("Payment Details:", margin, y, { font: bold, size: 11 });
    y -= 16;
    const rows: [string, string][] = [
      ["Account title", profile?.bank_account_title || "—"],
      ["Bank", profile?.bank_name || "—"],
      ["IBAN", profile?.iban || "—"],
      ["SWIFT Code", profile?.swift_code || "—"],
    ];
    const labelCol = 140;
    const valCol = contentWidth - labelCol;
    const VAL_WRAP = 44;
    for (let i = 0; i < rows.length; i++) {
      const [k, v] = rows[i];
      const bg = i === 0 ? headerBg : undefined;
      const vLines = wrapText(v, VAL_WRAP);
      const rowH = Math.max(22, vLines.length * 13 + 8);
      drawRect(margin, y, labelCol, rowH, bg);
      drawRect(margin + labelCol, y, valCol, rowH, bg);
      drawText(k, margin + 8, y - 15, { font: i === 0 ? bold : font });
      let vy = y - 15;
      for (const ln of vLines) {
        drawText(ln, margin + labelCol + 8, vy, { font: i === 0 ? bold : font });
        vy -= 13;
      }
      y -= rowH;
    }

    if (invoice.notes) {
      y -= 20;
      drawText("Notes", margin, y, { font: bold, size: 10, color: grey });
      y -= 14;
      for (const line of wrapText(invoice.notes, 90)) { drawText(line, margin, y); y -= 13; }
    }

    await supabaseAdmin.from("invoices").update({ pdf_generated_at: new Date().toISOString() }).eq("id", data.invoiceId);

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