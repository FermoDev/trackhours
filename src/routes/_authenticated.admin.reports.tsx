import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getReportSummary, type ReportSummary, type ReportClient } from "@/lib/reports.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ArrowLeft, ChevronDown, ChevronRight, Clock, Copy, DollarSign, Download, Receipt, TrendingDown, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";

type Search = { client?: string };

export const Route = createFileRoute("/_authenticated/admin/reports")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    client: typeof search['client'] === "string" ? (search['client'] as string) : undefined,
  }),
  component: AdminReportsPage,
  head: () => ({
    meta: [
      { title: "Client Reports | TrackHours Admin" },
      { name: "description", content: "Client-by-client reporting on hours, revenue and invoicing, with monthly trends you can share with your team." },
      { property: "og:title", content: "Client Reports | TrackHours Admin" },
      { property: "og:description", content: "Client-by-client hours, revenue and invoicing with monthly trends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const iso = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "this-month") return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (preset === "last-month") return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (preset === "this-quarter") {
    const qs = Math.floor(m / 3) * 3;
    return { from: iso(new Date(y, qs, 1)), to: iso(new Date(y, qs + 3, 0)) };
  }
  if (preset === "ytd") return { from: iso(new Date(y, 0, 1)), to: iso(now) };
  if (preset === "all") return { from: "2000-01-01", to: iso(new Date(y + 1, 0, 0)) };
  return null;
}

const money = (n: number) =>
  `CAD ${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hrs = (min: number) => `${(Math.round((min / 60) * 10) / 10).toFixed(1)}h`;
const monthLabel = (m: string) => {
  const [yy, mm] = m.split("-");
  return new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString("en-CA", { month: "short", year: "2-digit" });
};

function Delta({ current, previous, format }: { current: number; previous: number; format: (n: number) => string }) {
  if (previous <= 0 && current <= 0) return null;
  if (previous <= 0) return <span className="text-xs text-muted-foreground">new this period</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${up ? "text-primary" : "text-destructive"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct}% vs previous ({format(previous)})
    </span>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}<span className="text-xs">{label}</span>
        </div>
        <p className="text-lg font-bold font-mono">{value}</p>
        {sub && <div className="mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: { month: string; hours: number; revenue: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground p-6 text-center">No activity in this period.</p>;
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            formatter={(value: any, name: any) => (name === "revenue" ? money(Number(value)) : `${Number(value).toFixed(1)}h`)}
            contentStyle={{ borderRadius: 12, fontSize: 12 }}
          />
          <Bar yAxisId="left" dataKey="hours" name="hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} opacity={0.75} />
          <Line yAxisId="right" dataKey="revenue" name="revenue" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function downloadCSV(filename: string, header: string, rows: string[][]) {
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function AdminReportsPage() {
  const navigate = useNavigate({ from: "/admin/reports" });
  const { client: selectedId } = Route.useSearch();
  const reportFn = useServerFn(getReportSummary);

  const [preset, setPreset] = useState("this-month");
  const initial = presetRange("this-month")!;
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await reportFn({ data: { from, to } }));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [from, to, reportFn]);

  useEffect(() => { refresh(); }, [refresh]);

  const onPreset = (value: string) => {
    setPreset(value);
    const r = presetRange(value);
    if (r) { setFrom(r.from); setTo(r.to); }
  };

  const activeClients = useMemo(() => (data?.clients ?? []).filter((c) => c.minutes > 0), [data]);
  const selected = useMemo(
    () => (selectedId ? (data?.clients ?? []).find((c) => c.clientId === selectedId) ?? null : null),
    [data, selectedId],
  );

  const overviewTrend = useMemo(
    () => (data?.months ?? []).map((m) => ({ month: monthLabel(m.month), hours: m.minutes / 60, revenue: m.earned })),
    [data],
  );

  const select = (id?: string) => navigate({ search: id ? { client: id } : {} });

  const exportOverview = () => {
    if (!data) return;
    downloadCSV(
      `client-report-${from}-to-${to}.csv`,
      "Client,Hours,Billable hours,Revenue earned (CAD),Invoiced (CAD),To invoice (CAD),Entries,People",
      activeClients.map((c) => [
        c.clientName, (c.minutes / 60).toFixed(2), (c.billableMinutes / 60).toFixed(2),
        c.earned.toFixed(2), c.invoiced.toFixed(2), c.remaining.toFixed(2), String(c.entryCount), String(c.peopleCount),
      ]),
    );
  };

  const exportClient = (c: ReportClient) => {
    downloadCSV(
      `${c.clientName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report-${from}-to-${to}.csv`,
      "Section,Name,Hours,Revenue (CAD)",
      [
        ...c.projects.map((p) => ["Project", p.name, (p.minutes / 60).toFixed(2), p.earned.toFixed(2)]),
        ...c.people.map((p) => ["Person", p.name, (p.minutes / 60).toFixed(2), p.earned.toFixed(2)]),
        ...c.months.map((m) => ["Month", m.month, (m.minutes / 60).toFixed(2), m.earned.toFixed(2)]),
      ],
    );
  };

  const copySummary = (c: ReportClient) => {
    const lines = [
      `${c.clientName} — ${from} to ${to}`,
      `Hours: ${hrs(c.minutes)} (billable ${hrs(c.billableMinutes)})`,
      c.hasRate ? `Revenue: ${money(c.earned)} · invoiced ${money(c.invoiced)} · to invoice ${money(c.remaining)}` : "Revenue: no hourly rate set",
      "",
      "Top projects:",
      ...c.projects.slice(0, 5).map((p) => `- ${p.name}: ${hrs(p.minutes)}${c.hasRate ? ` (${money(p.earned)})` : ""}`),
      "",
      "People:",
      ...c.people.map((p) => `- ${p.name}: ${hrs(p.minutes)}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Summary copied — paste it into your update");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Client-by-client hours and revenue. Admin only.</p>
        </div>
        <Button variant="outline" onClick={selected ? () => exportClient(selected) : exportOverview} className="rounded-xl">
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* Period */}
      <Card>
        <CardContent className="pt-5 pb-4 flex flex-wrap items-center gap-3">
          <Select value={preset} onValueChange={onPreset}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This month</SelectItem>
              <SelectItem value="last-month">Last month</SelectItem>
              <SelectItem value="this-quarter">This quarter</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className="w-[160px]" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className="w-[160px]" />
          {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
        </CardContent>
      </Card>

      {data && !selected && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<Clock className="h-3.5 w-3.5" />} label="Total hours" value={hrs(data.totals.minutes)}
              sub={<Delta current={data.totals.minutes} previous={data.previous.minutes} format={hrs} />}
            />
            <StatCard
              icon={<DollarSign className="h-3.5 w-3.5" />} label="Revenue earned" value={money(data.totals.earned)}
              sub={<Delta current={data.totals.earned} previous={data.previous.earned} format={money} />}
            />
            <StatCard
              icon={<Receipt className="h-3.5 w-3.5" />} label="Invoiced" value={money(data.totals.invoiced)}
              sub={<span className="text-xs text-muted-foreground">{money(data.totals.remaining)} still to invoice</span>}
            />
            <StatCard
              icon={<Users className="h-3.5 w-3.5" />} label="Active clients" value={String(data.totals.activeClients)}
              sub={<span className="text-xs text-muted-foreground">{data.totals.activePeople} people · {data.totals.entryCount} entries</span>}
            />
          </div>

          <Card>
            <CardContent className="pt-5">
              <h2 className="text-sm font-semibold mb-2">Hours &amp; revenue by month</h2>
              <TrendChart data={overviewTrend} />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Clients</h2>
            {activeClients.length === 0 && (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No time logged in this period.</CardContent></Card>
            )}
            {activeClients.map((c) => {
              const share = data.totals.minutes > 0 ? Math.round((c.minutes / data.totals.minutes) * 100) : 0;
              const open = expanded === c.clientId;
              return (
                <Card key={c.clientId}>
                  <CardContent className="pt-5 pb-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{c.clientName}</h3>
                          {!c.hasRate && <Badge variant="outline" className="text-[10px]">no rate set</Badge>}
                        </div>
                        <Delta current={c.minutes} previous={c.prevMinutes} format={hrs} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setExpanded(open ? null : c.clientId)}>
                          {open ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                          Breakdown
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => select(c.clientId)}>View details</Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Hours</p><p className="font-mono font-semibold">{hrs(c.minutes)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Revenue</p><p className="font-mono font-semibold">{c.hasRate ? money(c.earned) : "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Invoiced</p><p className="font-mono">{c.hasRate ? money(c.invoiced) : "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">To invoice</p><p className="font-mono">{c.hasRate ? money(c.remaining) : "—"}</p></div>
                    </div>

                    <div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${share}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{share}% of total hours · {c.peopleCount} {c.peopleCount === 1 ? "person" : "people"}</p>
                    </div>

                    {open && (
                      <div className="grid md:grid-cols-2 gap-6 pt-2 border-t">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mt-3 mb-1">Projects</p>
                          {c.projects.map((p) => (
                            <div key={p.id} className="flex justify-between text-sm py-1">
                              <span className="truncate pr-3">{p.name}</span>
                              <span className="font-mono text-muted-foreground">{hrs(p.minutes)}{c.hasRate ? ` · ${money(p.earned)}` : ""}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mt-3 mb-1">People</p>
                          {c.people.map((p) => (
                            <div key={p.id} className="flex justify-between text-sm py-1">
                              <span className="truncate pr-3">{p.name}</span>
                              <span className="font-mono text-muted-foreground">{hrs(p.minutes)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {data && selected && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => select(undefined)}>
              <ArrowLeft className="h-4 w-4 mr-1" />All clients
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => copySummary(selected)}>
                <Copy className="h-4 w-4 mr-2" />Copy summary
              </Button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold">{selected.clientName}</h2>
            <p className="text-sm text-muted-foreground">{from} to {to}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="Hours" value={hrs(selected.minutes)}
              sub={<Delta current={selected.minutes} previous={selected.prevMinutes} format={hrs} />} />
            <StatCard icon={<DollarSign className="h-3.5 w-3.5" />} label="Revenue earned" value={selected.hasRate ? money(selected.earned) : "—"}
              sub={<span className="text-xs text-muted-foreground">{selected.hasRate ? `${money(selected.hourlyRate)}/h` : "Set a rate on the Revenue page"}</span>} />
            <StatCard icon={<Receipt className="h-3.5 w-3.5" />} label="Invoiced" value={selected.hasRate ? money(selected.invoiced) : "—"}
              sub={<span className="text-xs text-muted-foreground">{selected.hasRate ? `${money(selected.remaining)} to invoice` : ""}</span>} />
            <StatCard icon={<Users className="h-3.5 w-3.5" />} label="People" value={String(selected.peopleCount)}
              sub={<span className="text-xs text-muted-foreground">{selected.entryCount} entries</span>} />
          </div>

          <Card>
            <CardContent className="pt-5">
              <h3 className="text-sm font-semibold mb-2">Month by month</h3>
              <TrendChart data={selected.months.map((m) => ({ month: monthLabel(m.month), hours: m.minutes / 60, revenue: m.earned }))} />
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-0">
                <div className="px-5 pt-5 pb-2 text-sm font-semibold">By project</div>
                <Table>
                  <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Hours</TableHead><TableHead>Revenue</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selected.projects.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.name}</TableCell>
                        <TableCell className="font-mono text-sm">{hrs(p.minutes)}</TableCell>
                        <TableCell className="font-mono text-sm">{selected.hasRate ? money(p.earned) : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{selected.minutes > 0 ? Math.round((p.minutes / selected.minutes) * 100) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="px-5 pt-5 pb-2 text-sm font-semibold">By person</div>
                <Table>
                  <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Hours</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selected.people.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.name}</TableCell>
                        <TableCell className="font-mono text-sm">{hrs(p.minutes)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{selected.minutes > 0 ? Math.round((p.minutes / selected.minutes) * 100) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="px-5 pt-5 pb-2 text-sm font-semibold">Recent entries</div>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Person</TableHead><TableHead>Project</TableHead><TableHead className="hidden md:table-cell">Description</TableHead><TableHead>Hours</TableHead></TableRow></TableHeader>
                <TableBody>
                  {selected.recentEntries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm whitespace-nowrap">{e.date}</TableCell>
                      <TableCell className="text-sm">{e.person}</TableCell>
                      <TableCell className="text-sm">{e.project}</TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell max-w-[320px] truncate">{e.description}</TableCell>
                      <TableCell className="font-mono text-sm">{hrs(e.minutes)}</TableCell>
                    </TableRow>
                  ))}
                  {selected.recentEntries.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No entries in this period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
