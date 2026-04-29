import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { managerListTeammates } from "@/server/manager.functions";
import { authHeaders } from "@/lib/server-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/manager/")({
  component: ManagerOverview,
});

type Range = "week" | "month" | "all";

type TeammateProfile = { user_id: string; full_name: string; email: string };

function ManagerOverview() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [profiles, setProfiles] = useState<TeammateProfile[]>([]);
  const [entries, setEntries] = useState<Tables<"time_entries">[]>([]);
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [range, setRange] = useState<Range>("week");
  const [loading, setLoading] = useState(true);

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    if (range === "week") {
      return {
        fromDate: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        toDate: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    if (range === "month") {
      return {
        fromDate: format(startOfMonth(now), "yyyy-MM-dd"),
        toDate: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    return { fromDate: null as string | null, toDate: null as string | null };
  }, [range]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Clients the manager can see (RLS already restricts to assigned clients for managers).
      const clientsRes = await supabase.from("clients").select("*").order("name");

      // Build entries query
      let q = supabase
        .from("time_entries")
        .select("*")
        .neq("user_id", user.id) // exclude self -- this view is about team
        .order("entry_date", { ascending: false });

      if (clientFilter !== "all") q = q.eq("client_id", clientFilter);
      if (fromDate) q = q.gte("entry_date", fromDate);
      if (toDate) q = q.lte("entry_date", toDate);

      const entriesRes = await q.limit(500);

      // Profiles of teammates — fetched via server function which sanitizes
      // sensitive fields (hourly_rate is never returned).
      const headers = await authHeaders();
      const profilesRes = await managerListTeammates({ headers }).catch(() => ({ profiles: [] as TeammateProfile[] }));

      // Projects to display project names
      const projectsRes = await supabase.from("projects").select("*");

      if (cancelled) return;
      if (clientsRes.data) setClients(clientsRes.data);
      if (entriesRes.data) setEntries(entriesRes.data);
      if (profilesRes.profiles) setProfiles(profilesRes.profiles);
      if (projectsRes.data) setProjects(projectsRes.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, clientFilter, fromDate, toDate]);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.user_id, p])), [profiles]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const billableMinutes = entries.filter(e => e.billable).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const activeMembers = new Set(entries.map(e => e.user_id)).size;

  // Per-teammate breakdown
  const teamBreakdown = useMemo(() => {
    const map = new Map<string, { userId: string; minutes: number; billableMinutes: number; lastEntry: string | null }>();
    for (const e of entries) {
      const cur = map.get(e.user_id) ?? { userId: e.user_id, minutes: 0, billableMinutes: 0, lastEntry: null };
      cur.minutes += e.duration_minutes ?? 0;
      if (e.billable) cur.billableMinutes += e.duration_minutes ?? 0;
      if (!cur.lastEntry || e.entry_date > cur.lastEntry) cur.lastEntry = e.entry_date;
      map.set(e.user_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Overview</h1>
          <p className="text-sm text-muted-foreground">Time logged by teammates on clients you manage.</p>
        </div>
        <div className="flex gap-2">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All my clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total team hours</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{formatDuration(totalMinutes)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Billable hours</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{formatDuration(billableMinutes)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active teammates</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{activeMembers}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">By teammate</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead>Last entry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamBreakdown.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{loading ? "Loading..." : "No team activity in this range."}</TableCell></TableRow>
              )}
              {teamBreakdown.map(row => {
                const p = profileMap.get(row.userId);
                const pct = row.minutes > 0 ? Math.round((row.billableMinutes / row.minutes) * 100) : 0;
                return (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{p?.full_name || p?.email || "Unknown"}</TableCell>
                    <TableCell>{formatDuration(row.minutes)}</TableCell>
                    <TableCell>{formatDuration(row.billableMinutes)} <span className="text-xs text-muted-foreground">({pct}%)</span></TableCell>
                    <TableCell>{row.lastEntry ? format(new Date(row.lastEntry), "MMM d, yyyy") : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent entries</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Teammate</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{loading ? "Loading..." : "No entries."}</TableCell></TableRow>
              )}
              {entries.slice(0, 50).map(e => {
                const p = profileMap.get(e.user_id);
                const c = clientMap.get(e.client_id);
                const pr = projectMap.get(e.project_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(e.entry_date), "MMM d")}</TableCell>
                    <TableCell>{p?.full_name || p?.email || "—"}</TableCell>
                    <TableCell>{c?.name || "—"}</TableCell>
                    <TableCell>{pr?.name || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDuration(e.duration_minutes ?? 0)}
                      {!e.billable && <Badge variant="secondary" className="ml-2 text-xs">non-billable</Badge>}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{e.description || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}