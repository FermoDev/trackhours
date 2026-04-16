import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchEntries = useCallback(async () => {
    let q = supabase.from("time_entries").select("*, clients(name), projects(name)").order("entry_date", { ascending: false }).limit(200);
    if (filterClient !== "all") q = q.eq("client_id", filterClient);
    if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
    if (filterDateFrom) q = q.gte("entry_date", filterDateFrom);
    if (filterDateTo) q = q.lte("entry_date", filterDateTo);
    const { data } = await q;
    if (!data) return;

    // Attach profile names
    const userIds = [...new Set(data.map(e => e.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    const profMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
    setEntries((data as any[]).map(e => ({ ...e, profiles: { full_name: profMap.get(e.user_id) || "Unknown" } })));
  }, [filterClient, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => {
    supabase.from("clients").select("*").order("name").then(({ data }) => data && setClients(data));
    supabase.from("projects").select("*").order("name").then(({ data }) => data && setProjects(data));
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const approveEntry = async (id: string) => {
    await supabase.from("time_entries").update({ status: "approved" as const }).eq("id", id);
    fetchEntries();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">All Time Entries</h1>
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          </div>
        </CardContent>
      </Card>
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
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{e.entry_date}</TableCell>
                  <TableCell>{e.profiles?.full_name || "—"}</TableCell>
                  <TableCell>{e.clients?.name || "—"}</TableCell>
                  <TableCell>{e.projects?.name || "—"}</TableCell>
                  <TableCell className="font-mono">{e.duration_minutes ? formatDuration(e.duration_minutes) : "—"}</TableCell>
                  <TableCell><Badge variant={e.status === "approved" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                  <TableCell>
                    {e.status === "submitted" && (
                      <Button size="sm" variant="outline" onClick={() => approveEntry(e.id)}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>
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
