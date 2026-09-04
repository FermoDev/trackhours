import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export type BreakdownRow = { id: string; name: string; minutes: number; earned: number };
export type MonthPoint = { month: string; minutes: number; earned: number };
export type ReportEntry = {
  id: string;
  date: string;
  person: string;
  project: string;
  description: string;
  minutes: number;
  billable: boolean;
  invoiced: boolean;
};

export type ReportClient = {
  clientId: string;
  clientName: string;
  hourlyRate: number;
  hasRate: boolean;
  minutes: number;
  billableMinutes: number;
  invoicedMinutes: number;
  earned: number;
  invoiced: number;
  remaining: number;
  entryCount: number;
  peopleCount: number;
  prevMinutes: number;
  prevEarned: number;
  projects: BreakdownRow[];
  people: BreakdownRow[];
  months: MonthPoint[];
  recentEntries: ReportEntry[];
};

export type ReportSummary = {
  range: { from: string; to: string };
  totals: {
    minutes: number;
    billableMinutes: number;
    earned: number;
    invoiced: number;
    remaining: number;
    entryCount: number;
    activeClients: number;
    activePeople: number;
  };
  previous: { from: string; to: string; minutes: number; earned: number };
  months: MonthPoint[];
  clients: ReportClient[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function previousRange(from: string, to: string) {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const days = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1);
  const prevTo = new Date(f.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

export const getReportSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rangeSchema.parse(data))
  .handler(async ({ data, context }): Promise<ReportSummary> => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const prev = previousRange(data.from, data.to);

    const [clientsRes, projectsRes, profilesRes, ratesRes, entriesRes, prevRes] = await Promise.all([
      supabaseAdmin.from("clients").select("id, name").order("name"),
      supabaseAdmin.from("projects").select("id, name"),
      supabaseAdmin.from("profiles").select("user_id, full_name, email"),
      supabaseAdmin.from("client_rates").select("client_id, hourly_rate_cents, currency"),
      supabaseAdmin
        .from("time_entries")
        .select("id, client_id, project_id, user_id, entry_date, duration_minutes, invoice_id, billable, description")
        .not("duration_minutes", "is", null)
        .gte("entry_date", data.from)
        .lte("entry_date", data.to),
      supabaseAdmin
        .from("time_entries")
        .select("client_id, duration_minutes, billable")
        .not("duration_minutes", "is", null)
        .gte("entry_date", prev.from)
        .lte("entry_date", prev.to),
    ]);

    for (const r of [clientsRes, projectsRes, profilesRes, ratesRes, entriesRes, prevRes]) {
      if (r.error) throw new Error(r.error.message);
    }

    const projectName = new Map((projectsRes.data ?? []).map((p) => [p.id, p.name]));
    const personName = new Map(
      (profilesRes.data ?? []).map((p) => [p.user_id, p.full_name?.trim() || p.email || "Unknown"]),
    );
    const rateMap = new Map((ratesRes.data ?? []).map((r) => [r.client_id, Number(r.hourly_rate_cents) / 100]));

    type Acc = {
      minutes: number;
      billableMinutes: number;
      invoicedMinutes: number;
      entryCount: number;
      projects: Map<string, number>;
      people: Map<string, number>;
      months: Map<string, number>;
      entries: ReportEntry[];
    };
    const acc = new Map<string, Acc>();
    const blank = (): Acc => ({
      minutes: 0,
      billableMinutes: 0,
      invoicedMinutes: 0,
      entryCount: 0,
      projects: new Map(),
      people: new Map(),
      months: new Map(),
      entries: [],
    });

    const allPeople = new Set<string>();
    const monthTotals = new Map<string, { minutes: number; earned: number }>();

    for (const e of entriesRes.data ?? []) {
      const a = acc.get(e.client_id) ?? blank();
      const mins = e.duration_minutes ?? 0;
      const month = String(e.entry_date).slice(0, 7);
      a.minutes += mins;
      a.entryCount += 1;
      if (e.billable) a.billableMinutes += mins;
      if (e.invoice_id) a.invoicedMinutes += mins;
      if (e.project_id) a.projects.set(e.project_id, (a.projects.get(e.project_id) ?? 0) + mins);
      a.people.set(e.user_id, (a.people.get(e.user_id) ?? 0) + mins);
      a.months.set(month, (a.months.get(month) ?? 0) + mins);
      a.entries.push({
        id: e.id,
        date: e.entry_date,
        person: personName.get(e.user_id) ?? "Unknown",
        project: e.project_id ? projectName.get(e.project_id) ?? "Unknown" : "—",
        description: e.description ?? "",
        minutes: mins,
        billable: !!e.billable,
        invoiced: !!e.invoice_id,
      });
      allPeople.add(e.user_id);
      acc.set(e.client_id, a);
    }

    const prevAcc = new Map<string, { minutes: number; billableMinutes: number }>();
    for (const e of prevRes.data ?? []) {
      const cur = prevAcc.get(e.client_id) ?? { minutes: 0, billableMinutes: 0 };
      cur.minutes += e.duration_minutes ?? 0;
      if (e.billable) cur.billableMinutes += e.duration_minutes ?? 0;
      prevAcc.set(e.client_id, cur);
    }

    const clients: ReportClient[] = (clientsRes.data ?? [])
      .map((c) => {
        const a = acc.get(c.id) ?? blank();
        const rate = rateMap.get(c.id) ?? 0;
        const hasRate = rateMap.has(c.id) && rate > 0;
        const earned = (a.billableMinutes / 60) * rate;
        const invoiced = (a.invoicedMinutes / 60) * rate;
        const p = prevAcc.get(c.id) ?? { minutes: 0, billableMinutes: 0 };

        const monthsArr: MonthPoint[] = Array.from(a.months.entries())
          .sort((x, y) => x[0].localeCompare(y[0]))
          .map(([month, minutes]) => ({ month, minutes, earned: round2((minutes / 60) * rate) }));

        for (const [month, minutes] of a.months.entries()) {
          const mt = monthTotals.get(month) ?? { minutes: 0, earned: 0 };
          mt.minutes += minutes;
          mt.earned += (minutes / 60) * rate;
          monthTotals.set(month, mt);
        }

        return {
          clientId: c.id,
          clientName: c.name,
          hourlyRate: rate,
          hasRate,
          minutes: a.minutes,
          billableMinutes: a.billableMinutes,
          invoicedMinutes: a.invoicedMinutes,
          earned: round2(earned),
          invoiced: round2(invoiced),
          remaining: round2(earned - invoiced),
          entryCount: a.entryCount,
          peopleCount: a.people.size,
          prevMinutes: p.minutes,
          prevEarned: round2((p.billableMinutes / 60) * rate),
          projects: Array.from(a.projects.entries())
            .map(([id, minutes]) => ({
              id,
              name: projectName.get(id) ?? "Unknown",
              minutes,
              earned: round2((minutes / 60) * rate),
            }))
            .sort((x, y) => y.minutes - x.minutes),
          people: Array.from(a.people.entries())
            .map(([id, minutes]) => ({
              id,
              name: personName.get(id) ?? "Unknown",
              minutes,
              earned: round2((minutes / 60) * rate),
            }))
            .sort((x, y) => y.minutes - x.minutes),
          months: monthsArr,
          recentEntries: a.entries
            .sort((x, y) => y.date.localeCompare(x.date))
            .slice(0, 25),
        };
      })
      .sort((a, b) => b.earned - a.earned || b.minutes - a.minutes || a.clientName.localeCompare(b.clientName));

    const totals = clients.reduce(
      (t, c) => ({
        minutes: t.minutes + c.minutes,
        billableMinutes: t.billableMinutes + c.billableMinutes,
        earned: t.earned + c.earned,
        invoiced: t.invoiced + c.invoiced,
        remaining: t.remaining + c.remaining,
        entryCount: t.entryCount + c.entryCount,
      }),
      { minutes: 0, billableMinutes: 0, earned: 0, invoiced: 0, remaining: 0, entryCount: 0 },
    );

    const prevTotals = clients.reduce(
      (t, c) => ({ minutes: t.minutes + c.prevMinutes, earned: t.earned + c.prevEarned }),
      { minutes: 0, earned: 0 },
    );

    return {
      range: { from: data.from, to: data.to },
      totals: {
        minutes: totals.minutes,
        billableMinutes: totals.billableMinutes,
        earned: round2(totals.earned),
        invoiced: round2(totals.invoiced),
        remaining: round2(totals.remaining),
        entryCount: totals.entryCount,
        activeClients: clients.filter((c) => c.minutes > 0).length,
        activePeople: allPeople.size,
      },
      previous: { from: prev.from, to: prev.to, minutes: prevTotals.minutes, earned: round2(prevTotals.earned) },
      months: Array.from(monthTotals.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({ month, minutes: v.minutes, earned: round2(v.earned) })),
      clients,
    };
  });
