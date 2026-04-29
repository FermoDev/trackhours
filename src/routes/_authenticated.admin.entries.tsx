import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, FileText, Send } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";

export const Route = createFileRoute("/_authenticated/admin/entries")({
  component: AdminEntriesPage,
});

type EntryWithRelations = Tables<"time_entries"> & {
  clients: { name: string } | null;
  projects: { name: string } | null;
  profiles?: { full_name: string } | null;
};

function AdminEntriesPage() {
  const [entries, setEntries] = useState<EntryWithRelations[]>([]);
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchEntries = useCallback(async () => {
    let q = supabase.from("time_entries").select("*, clients(name), projects(name)").order("entry_date", { ascending: false }).limit(200);
    if (filterClient !== "all") q = q.eq("client_id", filterClient);
    if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
    if (filterDateFrom) q = q.gte("entry_date", filterDateFrom);
    if (filterDateTo) q = q.lte("entry_date", filterDateTo);
    const { data } = await q;
    if (!data) return;

    const userIds = [...new Set(data.map(e => e.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    const profMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
    setEntries((data as any[]).map(e => ({ ...e, profiles: { full_name: profMap.get(e.user_id) || "Unknown" } })));
  }, [filterClient, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => {
    supabase.from("clients").select("*").order("name").then(({ data }) => data && setClients(data));
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const submittedEntries = useMemo(() => entries.filter(e => e.status === "submitted"), [entries]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAllSubmitted = () => {
    if (selected.size === submittedEntries.length && submittedEntries.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(submittedEntries.map(e => e.id)));
    }
  };

  const bulkApprove = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await supabase.from("time_entries").update({ status: "approved" as const }).in("id", ids);
    setSelected(new Set());
    fetchEntries();
  };

  const approveEntry = async (id: string) => {
    await supabase.from("time_entries").update({ status: "approved" as const }).eq("id", id);
    fetchEntries();
  };

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const pendingCount = submittedEntries.length;
  const approvedCount = entries.filter(e => e.status === "approved").length;

  const resetFilters = () => {
    setFilterClient("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };
  const hasFilters = filterClient !== "all" || filterStatus !== "all" || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">All Time Entries</h1>
        {selected.size > 0 && (
          <Button onClick={bulkApprove} className="rounded-xl">
            <CheckCircle className="h-4 w-4 mr-2" /> Approve {selected.size} entries
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><FileText className="h-3.5 w-3.5" /><span className="text-xs">Total entries</span></div>
            <p className="text-lg font-bold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /><span className="text-xs">Total hours</span></div>
            <p className="text-lg font-bold font-mono">{formatDuration(totalMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-warning mb-1"><Send className="h-3.5 w-3.5" /><span className="text-xs">Pending</span></div>
            <p className="text-lg font-bold">{pendingCount}</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="submitted">Submitted</SelectItem><SelectItem value="approved">Approved</SelectItem></SelectContent>
            </Select>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
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
                  {submittedEntries.length > 0 && (
                    <Checkbox
                      checked={selected.size === submittedEntries.length && submittedEntries.length > 0}
                      onCheckedChange={selectAllSubmitted}
                    />
                  )}
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id} className="hover:bg-muted/30">
                  <TableCell>
                    {e.status === "submitted" && (
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={() => toggleSelect(e.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{e.entry_date}</TableCell>
                  <TableCell className="text-sm">{e.profiles?.full_name || "—"}</TableCell>
                  <TableCell className="text-sm">{e.clients?.name || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{e.projects?.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{e.duration_minutes ? formatDuration(e.duration_minutes) : "—"}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${e.status === "approved" ? "bg-success/10 text-success" : e.status === "submitted" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{e.status}</span>
                  </TableCell>
                  <TableCell>
                    {e.status === "submitted" && (
                      <Button size="sm" variant="ghost" onClick={() => approveEntry(e.id)} className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />Approve
                      </Button>
                    )}
                    <DeleteEntryButton entryId={e.id} onDeleted={fetchEntries} />
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
