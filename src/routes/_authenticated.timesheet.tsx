import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";

export const Route = createFileRoute("/_authenticated/timesheet")({
  component: TimesheetPage,
});

type EntryWithRelations = Tables<"time_entries"> & {
  clients: { name: string } | null;
  projects: { name: string } | null;
};

function TimesheetPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<EntryWithRelations[]>([]);
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [filterClient, setFilterClient] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    let q = supabase.from("time_entries").select("*, clients(name), projects(name)").eq("user_id", user.id).order("entry_date", { ascending: false });
    if (filterClient !== "all") q = q.eq("client_id", filterClient);
    if (filterProject !== "all") q = q.eq("project_id", filterProject);
    if (filterDateFrom) q = q.gte("entry_date", filterDateFrom);
    if (filterDateTo) q = q.lte("entry_date", filterDateTo);
    const { data } = await q;
    setEntries((data as any) || []);
  }, [user, filterClient, filterProject, filterDateFrom, filterDateTo]);

  useEffect(() => {
    supabase.from("clients").select("*").eq("status", "active").then(({ data }) => data && setClients(data));
    supabase.from("projects").select("*").eq("status", "active").then(({ data }) => data && setProjects(data));
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const entryCount = entries.length;
  const billableMinutes = entries.filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0);

  const resetFilters = () => {
    setFilterClient("all");
    setFilterProject("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasFilters = filterClient !== "all" || filterProject !== "all" || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Timesheet</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /><span className="text-xs">Total</span></div>
            <p className="text-lg font-bold font-mono">{formatDuration(totalMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><FileText className="h-3.5 w-3.5" /><span className="text-xs">Entries</span></div>
            <p className="text-lg font-bold">{entryCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /><span className="text-xs">Billable</span></div>
            <p className="text-lg font-bold font-mono">{formatDuration(billableMinutes)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">Clear filters</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries found</TableCell></TableRow>
              ) : entries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/30">
                  <TableCell className="whitespace-nowrap text-sm">{entry.entry_date}</TableCell>
                  <TableCell className="text-sm">{entry.clients?.name || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{entry.projects?.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{entry.duration_minutes ? formatDuration(entry.duration_minutes) : "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground hidden sm:table-cell">{entry.description || "—"}</TableCell>
                  <TableCell>
                    {entry.duration_minutes && (
                      <DeleteEntryButton entryId={entry.id} onDeleted={fetchEntries} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
