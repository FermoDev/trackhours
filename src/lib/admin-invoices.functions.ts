import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const previewSchema = z.object({
  userId: z.string().uuid(),
  clientId: z.string().uuid(),
  from: z.string(),
  to: z.string(),
});

const createSchema = z.object({
  userId: z.string().uuid(),
  clientId: z.string().uuid(),
  from: z.string(),
  to: z.string(),
  rate: z.number().nonnegative(),
  currency: z.string().min(1),
  invoiceNumber: z.string().min(1),
  issueDate: z.string(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const previewAdminInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => previewSchema.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: entries, error } = await supabaseAdmin
      .from("time_entries")
      .select("id, project_id, duration_minutes, billable, invoice_id, projects(name)")
      .eq("user_id", data.userId)
      .eq("client_id", data.clientId)
      .eq("billable", true)
      .is("invoice_id", null)
      .gte("entry_date", data.from)
      .lte("entry_date", data.to);
    if (error) throw new Error(error.message);

    type Group = { projectId: string | null; name: string; minutes: number; entryIds: string[] };
    const byProject = new Map<string, Group>();
    for (const e of (entries as any[]) || []) {
      const pid = e.project_id || "none";
      const cur: Group = byProject.get(pid) || { projectId: e.project_id, name: e.projects?.name || "General", minutes: 0, entryIds: [] };
      cur.minutes += e.duration_minutes || 0;
      cur.entryIds.push(e.id);
      byProject.set(pid, cur);
    }

    const projects = Array.from(byProject.values()).map((p) => ({
      projectId: p.projectId,
      name: p.name,
      hours: p.minutes / 60,
      entryIds: p.entryIds,
    }));
    projects.sort((a, b) => a.name.localeCompare(b.name));
    return { projects };
  });

export const createAdminInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: entries, error: entErr } = await supabaseAdmin
      .from("time_entries")
      .select("id, project_id, duration_minutes, projects(name)")
      .eq("user_id", data.userId)
      .eq("client_id", data.clientId)
      .eq("billable", true)
      .is("invoice_id", null)
      .gte("entry_date", data.from)
      .lte("entry_date", data.to);
    if (entErr) throw new Error(entErr.message);
    if (!entries || entries.length === 0) throw new Error("No billable un-invoiced entries in this range");

    type Group = { projectId: string | null; name: string; minutes: number; entryIds: string[] };
    const byProject = new Map<string, Group>();
    for (const e of entries as any[]) {
      const pid = e.project_id || "none";
      const cur: Group = byProject.get(pid) || { projectId: e.project_id, name: e.projects?.name || "General", minutes: 0, entryIds: [] };
      cur.minutes += e.duration_minutes || 0;
      cur.entryIds.push(e.id);
      byProject.set(pid, cur);
    }

    const rateCents = Math.round(data.rate * 100);
    let subtotal = 0;
    const lineItems = Array.from(byProject.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p, idx) => {
        const hours = Math.round((p.minutes / 60) * 100) / 100;
        const amount = Math.round(hours * rateCents);
        subtotal += amount;
        return {
          project_id: p.projectId,
          description: `${p.name} — ${hours.toFixed(2)}h`,
          hours,
          rate_cents: rateCents,
          amount_cents: amount,
          sort_order: idx,
        };
      });

    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("invoices")
      .insert({
        user_id: data.userId,
        client_id: data.clientId,
        invoice_number: data.invoiceNumber,
        issue_date: data.issueDate,
        due_date: data.dueDate || null,
        period_start: data.from,
        period_end: data.to,
        currency: data.currency,
        subtotal_cents: subtotal,
        total_cents: subtotal,
        notes: data.notes || null,
        status: "draft",
      })
      .select()
      .single();
    if (invErr || !invoice) throw new Error(invErr?.message || "Failed to create invoice");

    const items = lineItems.map((li) => ({ ...li, invoice_id: invoice.id }));
    const { error: liErr } = await supabaseAdmin.from("invoice_line_items").insert(items);
    if (liErr) {
      await supabaseAdmin.from("invoices").delete().eq("id", invoice.id);
      throw new Error(liErr.message);
    }

    const allEntryIds = Array.from(byProject.values()).flatMap((p) => p.entryIds);
    await supabaseAdmin.from("time_entries").update({ invoice_id: invoice.id }).in("id", allEntryIds);

    return { invoiceId: invoice.id };
  });

const listSchema = z.object({}).optional();

export const listAdminInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listSchema.parse(data))
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invoices, error } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, issue_date, due_date, period_start, period_end, total_cents, currency, status, user_id, client_id, clients(name)")
      .order("issue_date", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = [...new Set((invoices || []).map((i: any) => i.user_id))];
    const { data: profs } = await supabaseAdmin.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
    const pmap = new Map((profs || []).map((p: any) => [p.user_id, p]));
    return (invoices || []).map((i: any) => ({
      ...i,
      client_name: i.clients?.name || "",
      freelancer_name: pmap.get(i.user_id)?.full_name || pmap.get(i.user_id)?.email || "Unknown",
    }));
  });

const deleteSchema = z.object({ invoiceId: z.string().uuid() });

export const deleteAdminInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Un-stamp entries (FK is SET NULL on delete, but be explicit)
    await supabaseAdmin.from("time_entries").update({ invoice_id: null }).eq("invoice_id", data.invoiceId);
    const { error } = await supabaseAdmin.from("invoices").delete().eq("id", data.invoiceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });