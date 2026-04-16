import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Clock, FileText, BarChart3 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: AdminReportsPage,
});

function AdminReportsPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [filterClient, setFilterClient] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("project");

  useEffect(() => {
    supabase.from("clients").select("*").order("name").then(({ data }) => data && setClients(data));
    supabase.from("projects").select("*").order("name").then(({ data }) => data && setProjects(data));
    supabase.from("profiles").select("*").order("full_name").then(({ data }) => data && setProfiles(data));
  }, []);

  const fetchEntries = useCallback(async () => {
    let q = supabase.from("time_entries").select("*, clients(name), projects(name)").not("duration_minutes", "is", null).order("entry_date", { ascending: false });
    if (filterClient !== "all") q = q.eq("client_id", filterClient);
    if (filterProject !== "all") q = q.eq("project_id", filterProject);
    if (filterUser !== "all") q = q.eq("user_id", filterUser);
    if (filterDateFrom) q = q.gte("entry_date", filterDateFrom);
    if (filterDateTo) q = q.lte("entry_date", filterDateTo);
    const { data } = await q;
    setEntries(data || []);
  }, [filterClient, filterProject, filterUser, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const grouped = new Map<string, { label: string; totalMinutes: number; count: number }>();
  entries.forEach((e: any) => {
    let key = "", label = "";
    if (groupBy === "project") { key = e.project_id; label = e.projects?.name || "Unknown"; }
    else if (groupBy === "client") { key = e.client_id; label = e.clients?.name || "Unknown"; }
    else { key = e.user_id; label = profiles.find(p => p.user_id === e.user_id)?.full_name || "Unknown"; }
    const cur = grouped.get(key) || { label, totalMinutes: 0, count: 0 };
    cur.totalMinutes += e.duration_minutes || 0;
    cur.count++;
    grouped.set(key, cur);
  });
  const groupedArr = Array.from(grouped.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  const totalMinutes = entries.reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);
  const maxMinutes = groupedArr.length > 0 ? groupedArr[0].totalMinutes : 1;

  // Unique days
  const uniqueDays = new Set(entries.map((e: any) => e.entry_date)).size;
  const avgPerDay = uniqueDays > 0 ? Math.round(totalMinutes / uniqueDays) : 0;

  const resetFilters = () => {
    setFilterClient("all");
    setFilterProject("all");
    setFilterUser("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };
  const hasFilters = filterClient !== "all" || filterProject !== "all" || filterUser !== "all" || filterDateFrom || filterDateTo;

  const exportCSV = () => {
    const profMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
    const header = "Date,User,Client,Project,Duration (min),Description,Billable,Status\n";
    const rows = entries.map((e: any) => [
      e.entry_date, profMap.get(e.user_id) || "", e.clients?.name || "", e.projects?.name || "",
      e.duration_minutes || "", `"${(e.description || "").replace(/"/g, '""')}"`, e.billable, e.status,
    ].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "time-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <Button variant="outline" onClick={exportCSV} className="rounded-xl"><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /><span className="text-xs">Total hours</span></div>
            <p className="text-lg font-bold font-mono">{formatDuration(totalMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><FileText className="h-3.5 w-3.5" /><span className="text-xs">Total entries</span></div>
            <p className="text-lg font-bold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><BarChart3 className="h-3.5 w-3.5" /><span className="text-xs">Avg / day</span></div>
            <p className="text-lg font-bold font-mono">{formatDuration(avgPerDay)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All users</SelectItem>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="project">By project</SelectItem><SelectItem value="client">By client</SelectItem><SelectItem value="user">By freelancer</SelectItem></SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">Clear filters</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grouped table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{groupBy === "user" ? "Freelancer" : groupBy === "client" ? "Client" : "Project"}</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Total Time</TableHead>
                <TableHead className="hidden sm:table-cell">%</TableHead>
                <TableHead className="hidden sm:table-cell w-[200px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedArr.map((g, i) => {
                const pct = totalMinutes > 0 ? Math.round((g.totalMinutes / totalMinutes) * 100) : 0;
                const barWidth = maxMinutes > 0 ? (g.totalMinutes / maxMinutes) * 100 : 0;
                return (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-sm">{g.label}</TableCell>
                    <TableCell className="text-sm">{g.count}</TableCell>
                    <TableCell className="font-mono text-sm">{formatDuration(g.totalMinutes)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{pct}%</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {groupedArr.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
