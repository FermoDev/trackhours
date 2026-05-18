import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Tables } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { mergeProjects } from "@/lib/clients.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  validateSearch: (search: Record<string, unknown>): { client?: string } => ({
    client: typeof search.client === "string" ? search.client : undefined,
  }),
  component: AdminProjectsPage,
});

function AdminProjectsPage() {
  const { client: clientFilterParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/projects" });
  const [projects, setProjects] = useState<(Tables<"projects"> & { clients: { name: string } | null })[]>([]);
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [clientFilter, setClientFilter] = useState<string>(clientFilterParam || "all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [desc, setDesc] = useState("");
  const [billable, setBillable] = useState(true);
  const [mergeSource, setMergeSource] = useState<(Tables<"projects"> & { clients: { name: string } | null }) | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);
  const [adding, setAdding] = useState(false);
  const mergeProjectsFn = useServerFn(mergeProjects);

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*, clients(name)");
    if (data) setProjects(data as any);
  };

  useEffect(() => {
    fetchProjects();
    supabase.from("clients").select("*").eq("status", "active").order("name").then(({ data }) => data && setClients(data));
  }, []);

  useEffect(() => {
    setClientFilter(clientFilterParam || "all");
  }, [clientFilterParam]);

  const handleFilterChange = (value: string) => {
    setClientFilter(value);
    navigate({ search: value === "all" ? {} : { client: value }, replace: true });
  };

  const handleAdd = async () => {
    if (!name || !clientId) return;
    setAdding(true);
    await supabase.from("projects").insert({ name, client_id: clientId, description: desc || null, billable_default: billable });
    setName(""); setClientId(""); setDesc(""); setBillable(true); setDialogOpen(false);
    await fetchProjects();
    setAdding(false);
  };

  const toggleStatus = async (project: Tables<"projects">) => {
    await supabase.from("projects").update({ status: project.status === "active" ? "inactive" as const : "active" as const }).eq("id", project.id);
    fetchProjects();
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setMerging(true);
    const result = await mergeProjectsFn({ data: { sourceId: mergeSource.id, targetId: mergeTargetId } });
    setMerging(false);
    if (!result.success) { toast.error(result.error || "Merge failed"); return; }
    toast.success("Projects merged");
    setMergeSource(null);
    setMergeTargetId("");
    fetchProjects();
  };

  const sorted = [...projects].sort((a, b) => {
    const cn = (a.clients?.name || "").localeCompare(b.clients?.name || "");
    return cn !== 0 ? cn : a.name.localeCompare(b.name);
  });
  const filtered = clientFilter === "all" ? sorted : sorted.filter(p => p.client_id === clientFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <Button onClick={() => setDialogOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />Add Project</Button>
      </div>
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground">Filter by client</Label>
        <Select value={clientFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {clientFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => handleFilterChange("all")}>Clear</Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No projects found.</TableCell></TableRow>
              )}
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    {p.clients?.name ? (
                      <Link to="/admin/clients" className="text-primary hover:underline">{p.clients.name}</Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{p.billable_default ? "Yes" : "No"}</TableCell>
                  <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleStatus(p)}>{p.status === "active" ? "Archive" : "Activate"}</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setMergeSource(p); setMergeTargetId(""); }}>Merge</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
            <DialogDescription className="sr-only">Create a new project under a client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div>
              <Label>Client</Label>
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">
                  No active clients yet — <Link to="/admin/clients" className="text-primary hover:underline">add a client first</Link>.
                </p>
              ) : (
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div><Label>Description</Label><Input value={desc} onChange={e => setDesc(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Checkbox id="billable" checked={billable} onCheckedChange={(v) => setBillable(!!v)} />
              <Label htmlFor="billable">Billable by default</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={!name || !clientId || adding}>
              {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {adding ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mergeSource} onOpenChange={(o) => { if (!o) { setMergeSource(null); setMergeTargetId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge "{mergeSource?.name}" into…</DialogTitle>
            <DialogDescription>All time entries from "{mergeSource?.name}" will be moved to the target project. "{mergeSource?.name}" will then be deleted. Target must belong to the same client ({mergeSource?.clients?.name}).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Target project</Label>
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger><SelectValue placeholder="Select target project" /></SelectTrigger>
              <SelectContent>
                {projects.filter(p => p.id !== mergeSource?.id && p.client_id === mergeSource?.client_id).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMergeSource(null); setMergeTargetId(""); }}>Cancel</Button>
            <Button onClick={handleMerge} disabled={!mergeTargetId || merging} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {merging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {merging ? "Merging…" : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
