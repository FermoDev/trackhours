import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

const setRateSchema = z.object({
  clientId: z.string().uuid(),
  hourlyRate: z.number().nonnegative(),
});

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export type ClientRevenueRow = {
  clientId: string;
  clientName: string;
  hourlyRate: number;
  currency: string;
  minutes: number;
  invoicedMinutes: number;
  earned: number;
  invoiced: number;
  remaining: number;
};

export const getClientRevenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rangeSchema.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [clientsRes, ratesRes, entriesRes] = await Promise.all([
      supabaseAdmin.from("clients").select("id, name").order("name"),
      supabaseAdmin.from("client_rates").select("client_id, hourly_rate_cents, currency"),
      supabaseAdmin
        .from("time_entries")
        .select("client_id, duration_minutes, invoice_id")
        .eq("billable", true)
        .not("duration_minutes", "is", null)
        .gte("entry_date", data.from)
        .lte("entry_date", data.to),
    ]);

    if (clientsRes.error) throw new Error(clientsRes.error.message);
    if (ratesRes.error) throw new Error(ratesRes.error.message);
    if (entriesRes.error) throw new Error(entriesRes.error.message);

    const rateMap = new Map(
      (ratesRes.data ?? []).map((r) => [r.client_id, r]),
    );

    const minutesMap = new Map<string, { total: number; invoiced: number }>();
    for (const e of entriesRes.data ?? []) {
      const cur = minutesMap.get(e.client_id) ?? { total: 0, invoiced: 0 };
      cur.total += e.duration_minutes ?? 0;
      if (e.invoice_id) cur.invoiced += e.duration_minutes ?? 0;
      minutesMap.set(e.client_id, cur);
    }

    const rows: ClientRevenueRow[] = (clientsRes.data ?? []).map((c) => {
      const rate = rateMap.get(c.id);
      const cents = Number(rate?.hourly_rate_cents ?? 0);
      const hourlyRate = cents / 100;
      const m = minutesMap.get(c.id) ?? { total: 0, invoiced: 0 };
      const earned = (m.total / 60) * hourlyRate;
      const invoiced = (m.invoiced / 60) * hourlyRate;
      return {
        clientId: c.id,
        clientName: c.name,
        hourlyRate,
        currency: rate?.currency ?? "CAD",
        minutes: m.total,
        invoicedMinutes: m.invoiced,
        earned: Math.round(earned * 100) / 100,
        invoiced: Math.round(invoiced * 100) / 100,
        remaining: Math.round((earned - invoiced) * 100) / 100,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        earned: acc.earned + r.earned,
        invoiced: acc.invoiced + r.invoiced,
        remaining: acc.remaining + r.remaining,
        minutes: acc.minutes + r.minutes,
      }),
      { earned: 0, invoiced: 0, remaining: 0, minutes: 0 },
    );

    return {
      rows,
      totals: {
        earned: Math.round(totals.earned * 100) / 100,
        invoiced: Math.round(totals.invoiced * 100) / 100,
        remaining: Math.round(totals.remaining * 100) / 100,
        minutes: totals.minutes,
      },
    };
  });

export const setClientRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setRateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("client_rates")
      .upsert(
        {
          client_id: data.clientId,
          hourly_rate_cents: Math.round(data.hourlyRate * 100),
          currency: "CAD",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" },
      );

    if (error) throw new Error(error.message);
    return { ok: true };
  });
