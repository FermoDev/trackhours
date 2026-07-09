import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, FileText } from "lucide-react";
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
  const [users, setUsers] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [filterClient, setFilterClient] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchEntries = useCallback(async () => {
    let q = supabase.from("time_entries").select("*, clients(name), projects(name)").order("entry_date", { ascending: false }).limit(200);
    if (filterClient !== "all") q = q.eq("client_id", filterClient);
    if (filterUser !== "all") q = q.eq("user_id", filterUser);
    if (filterDateFrom) q = q.gte("entry_date", filterDateFrom);
    if (filterDateTo) q = q.lte("entry_date", filterDateTo);
    const { data } = await q;
    if (!data) return;

    const userIds = [...new Set(data.map(e => e.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    const profMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
    setEntries((data as any[]).map(e => ({ ...e, profiles: { full_name: profMap.get(e.user_id) || "Unknown" } })));
  }, [filterClient, filterUser, filterDateFrom, filterDateTo]);

  useEffect(() => {
    supabase.from("clients").select("*").order("name").then(({ data }) => data && setClients(data));
    supabase.from("profiles").select("user_id, full_name").eq("status", "active").order("full_name").then(({ data }) => data && setUsers(data));
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const billableMinutes = entries.filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const uniqueUsers = new Set(entries.map(e => e.user_id)).size;

  const resetFilters = () => {
    setFilterClient("all");
    setFilterUser("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };
  const hasFilters = filterClient !== "all" || filterUser !== "all" || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">All Time Entries</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /><span className="text-xs">Billable</span></div>
            <p className="text-lg font-bold font-mono">{formatDuration(billableMinutes)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{uniqueUsers} {uniqueUsers === 1 ? "user" : "users"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All users</SelectItem>{users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || "Unknown"}</SelectItem>)}</SelectContent>
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
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id} className="hover:bg-muted/30">
                  <TableCell className="whitespace-nowrap text-sm">{e.entry_date}</TableCell>
                  <TableCell className="text-sm">{e.profiles?.full_name || "—"}</TableCell>
                  <TableCell className="text-sm">{e.clients?.name || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{e.projects?.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{e.duration_minutes ? formatDuration(e.duration_minutes) : "—"}</TableCell>
                  <TableCell>
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
