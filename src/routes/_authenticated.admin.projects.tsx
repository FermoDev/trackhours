import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  component: AdminProjectsPage,
});

function AdminProjectsPage() {
  const [projects, setProjects] = useState<(Tables<"projects"> & { clients: { name: string } | null })[]>([]);
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [desc, setDesc] = useState("");
  const [billable, setBillable] = useState(true);

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*, clients(name)").order("name");
    if (data) setProjects(data as any);
  };

  useEffect(() => {
    fetchProjects();
    supabase.from("clients").select("*").eq("status", "active").order("name").then(({ data }) => data && setClients(data));
  }, []);

  const handleAdd = async () => {
    if (!name || !clientId) return;
    await supabase.from("projects").insert({ name, client_id: clientId, description: desc || null, billable_default: billable });
    setName(""); setClientId(""); setDesc(""); setBillable(true); setDialogOpen(false);
    fetchProjects();
  };

  const toggleStatus = async (project: Tables<"projects">) => {
    await supabase.from("projects").update({ status: project.status === "active" ? "inactive" as const : "active" as const }).eq("id", project.id);
    fetchProjects();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <Button onClick={() => setDialogOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />Add Project</Button>
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
              {projects.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.clients?.name || "—"}</TableCell>
                  <TableCell>{p.billable_default ? "Yes" : "No"}</TableCell>
                  <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => toggleStatus(p)}>{p.status === "active" ? "Archive" : "Activate"}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={desc} onChange={e => setDesc(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Checkbox id="billable" checked={billable} onCheckedChange={(v) => setBillable(!!v)} />
              <Label htmlFor="billable">Billable by default</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAdd} disabled={!name || !clientId}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
