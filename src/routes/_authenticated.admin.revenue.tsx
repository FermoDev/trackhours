import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClientRevenue, setClientRate, type ClientRevenueRow } from "@/lib/revenue.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Download, DollarSign, Receipt, Hourglass } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/revenue")({
  component: AdminRevenuePage,
  head: () => ({
    meta: [
      { title: "Client Revenue | TrackHours Admin" },
      { name: "description", content: "Admin-only view of revenue earned and invoiced per client, based on each client's hourly rate." },
      { property: "og:title", content: "Client Revenue | TrackHours Admin" },
      { property: "og:description", content: "Admin-only view of revenue earned and invoiced per client." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const iso = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  if (preset === "this-month") {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (preset === "last-month") {
    return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  if (preset === "this-year") {
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)) };
  }
  return null;
}

const money = (n: number) => `CAD ${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hours = (min: number) => (Math.round((min / 60) * 10) / 10).toFixed(1);

function AdminRevenuePage() {
  const revenueFn = useServerFn(getClientRevenue);
  const rateFn = useServerFn(setClientRate);

  const [preset, setPreset] = useState("this-month");
  const initial = presetRange("this-month")!;
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<ClientRevenueRow[]>([]);
  const [totals, setTotals] = useState({ earned: 0, invoiced: 0, remaining: 0, minutes: 0 });
  const [loading, setLoading] = useState(true);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await revenueFn({ data: { from, to } });
      setRows(res.rows);
      setTotals(res.totals);
      setRateDrafts(Object.fromEntries(res.rows.map((r) => [r.clientId, r.hourlyRate ? String(r.hourlyRate) : ""])));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load revenue");
    } finally {
      setLoading(false);
    }
  }, [from, to, revenueFn]);

  useEffect(() => { refresh(); }, [refresh]);

  const onPreset = (value: string) => {
    setPreset(value);
    const r = presetRange(value);
    if (r) { setFrom(r.from); setTo(r.to); }
  };

  const saveRate = async (clientId: string) => {
    const raw = rateDrafts[clientId] ?? "";
    const value = Number(raw);
    if (raw.trim() === "" || Number.isNaN(value) || value < 0) {
      toast.error("Enter a valid hourly rate");
      return;
    }
    const existing = rows.find((r) => r.clientId === clientId);
    if (existing && existing.hourlyRate === value) return;
    try {
      await rateFn({ data: { clientId, hourlyRate: value } });
      toast.success("Rate saved");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save rate");
    }
  };

  const chartData = useMemo(
    () => rows.filter((r) => r.earned > 0).sort((a, b) => b.earned - a.earned).slice(0, 8).map((r) => ({ name: r.clientName, revenue: r.earned })),
    [rows],
  );

  const visibleRows = useMemo(
    () => [...rows].sort((a, b) => b.earned - a.earned || a.clientName.localeCompare(b.clientName)),
    [rows],
  );

  const exportCSV = () => {
    const header = "Client,Hourly rate (CAD),Billable hours,Earned,Invoiced,Remaining\n";
    const body = visibleRows.map((r) => [
      `"${r.clientName.replace(/"/g, '""')}"`, r.hourlyRate.toFixed(2), hours(r.minutes),
      r.earned.toFixed(2), r.invoiced.toFixed(2), r.remaining.toFixed(2),
    ].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `client-revenue-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
          <p className="text-muted-foreground text-sm mt-1">Admin only — client rates and revenue are never visible to freelancers.</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="rounded-xl"><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-3.5 w-3.5" /><span className="text-xs">Earned</span></div>
            <p className="text-lg font-bold font-mono">{money(totals.earned)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{hours(totals.minutes)} billable hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Receipt className="h-3.5 w-3.5" /><span className="text-xs">Invoiced</span></div>
            <p className="text-lg font-bold font-mono">{money(totals.invoiced)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Hourglass className="h-3.5 w-3.5" /><span className="text-xs">Not yet invoiced</span></div>
            <p className="text-lg font-bold font-mono">{money(totals.remaining)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={preset} onValueChange={onPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This month</SelectItem>
                <SelectItem value="last-month">Last month</SelectItem>
                <SelectItem value="this-year">This year</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} />
            <Input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} />
          </div>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium mb-3">Revenue by client</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="w-[150px]">Rate / hour</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Earned</TableHead>
                <TableHead className="hidden sm:table-cell">Invoiced</TableHead>
                <TableHead className="hidden sm:table-cell">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((r) => (
                <TableRow key={r.clientId} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">
                    {r.clientName}
                    {r.hourlyRate === 0 && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">no rate set</span>}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="h-8 w-[110px]"
                      value={rateDrafts[r.clientId] ?? ""}
                      onChange={(e) => setRateDrafts((d) => ({ ...d, [r.clientId]: e.target.value }))}
                      onBlur={() => saveRate(r.clientId)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{hours(r.minutes)}</TableCell>
                  <TableCell className="font-mono text-sm font-medium">{money(r.earned)}</TableCell>
                  <TableCell className="font-mono text-sm hidden sm:table-cell">{money(r.invoiced)}</TableCell>
                  <TableCell className="font-mono text-sm hidden sm:table-cell">{money(r.remaining)}</TableCell>
                </TableRow>
              ))}
              {!loading && visibleRows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No clients yet</TableCell></TableRow>
              )}
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
