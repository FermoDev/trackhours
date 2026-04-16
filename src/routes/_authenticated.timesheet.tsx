import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Clock, FileText, CheckCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    let q = supabase.from("time_entries").select("*, clients(name), projects(name)").eq("user_id", user.id).order("entry_date", { ascending: false });
    if (filterClient !== "all") q = q.eq("client_id", filterClient);
    if (filterProject !== "all") q = q.eq("project_id", filterProject);
    if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
    if (filterDateFrom) q = q.gte("entry_date", filterDateFrom);
    if (filterDateTo) q = q.lte("entry_date", filterDateTo);
    const { data } = await q;
    setEntries((data as any) || []);
  }, [user, filterClient, filterProject, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => {
    supabase.from("clients").select("*").eq("status", "active").then(({ data }) => data && setClients(data));
    supabase.from("projects").select("*").eq("status", "active").then(({ data }) => data && setProjects(data));
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const draftEntries = useMemo(() => entries.filter(e => e.status === "draft"), [entries]);
  const selectAllDrafts = () => {
    if (selected.size === draftEntries.length && draftEntries.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(draftEntries.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const submitSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await supabase.from("time_entries").update({ status: "submitted" as const }).in("id", ids);
    setSelected(new Set());
    fetchEntries();
  };

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const draftCount = draftEntries.length;
  const submittedCount = entries.filter(e => e.status === "submitted").length;
  const approvedCount = entries.filter(e => e.status === "approved").length;

  const resetFilters = () => {
    setFilterClient("all");
    setFilterProject("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasFilters = filterClient !== "all" || filterProject !== "all" || filterStatus !== "all" || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Timesheet</h1>
        {selected.size > 0 && (
          <Button onClick={submitSelected} className="rounded-xl">
            <Send className="h-4 w-4 mr-2" /> Submit {selected.size} entries
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /><span className="text-xs">Total</span></div>
            <p className="text-lg font-bold font-mono">{formatDuration(totalMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><FileText className="h-3.5 w-3.5" /><span className="text-xs">Drafts</span></div>
            <p className="text-lg font-bold">{draftCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-primary mb-1"><Send className="h-3.5 w-3.5" /><span className="text-xs">Submitted</span></div>
            <p className="text-lg font-bold">{submittedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-success mb-1"><CheckCircle className="h-3.5 w-3.5" /><span className="text-xs">Approved</span></div>
            <p className="text-lg font-bold">{approvedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
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
                <TableHead className="w-10">
                  {draftEntries.length > 0 && (
                    <Checkbox
                      checked={selected.size === draftEntries.length && draftEntries.length > 0}
                      onCheckedChange={selectAllDrafts}
                    />
                  )}
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No entries found</TableCell></TableRow>
              ) : entries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/30">
                  <TableCell>
                    {entry.status === "draft" && (
                      <Checkbox
                        checked={selected.has(entry.id)}
                        onCheckedChange={() => toggleSelect(entry.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{entry.entry_date}</TableCell>
                  <TableCell className="text-sm">{entry.clients?.name || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{entry.projects?.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{entry.duration_minutes ? formatDuration(entry.duration_minutes) : "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground hidden sm:table-cell">{entry.description || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${entry.status === "approved" ? "bg-success/10 text-success" : entry.status === "submitted" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{entry.status}</span>
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
