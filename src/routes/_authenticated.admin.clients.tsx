import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  component: AdminClientsPage,
});

function AdminClientsPage() {
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tables<"clients"> | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const fetchClients = async () => {
    const [{ data: cData }, { data: pData }] = await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("projects").select("client_id"),
    ]);
    if (cData) setClients(cData);
    if (pData) {
      const counts: Record<string, number> = {};
      for (const row of pData) counts[row.client_id] = (counts[row.client_id] || 0) + 1;
      setProjectCounts(counts);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleAdd = async () => {
    if (!name) return;
    await supabase.from("clients").insert({ name, code: code || null });
    setName(""); setCode(""); setDialogOpen(false);
    fetchClients();
  };

  const toggleStatus = async (client: Tables<"clients">) => {
    await supabase.from("clients").update({ status: client.status === "active" ? "inactive" as const : "active" as const }).eq("id", client.id);
    fetchClients();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("clients").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Cannot delete — client may have linked projects or entries"); }
    else { toast.success("Client deleted"); }
    setDeleteTarget(null);
    fetchClients();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <Button onClick={() => setDialogOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />Add Client</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.code || "—"}</TableCell>
                  <TableCell>
                    {projectCounts[c.id] ? (
                      <Link to="/admin/projects" search={{ client: c.id }} className="text-primary hover:underline">
                        {projectCounts[c.id]}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.created_at.slice(0, 10)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleStatus(c)}>{c.status === "active" ? "Archive" : "Activate"}</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Code (optional)</Label><Input value={code} onChange={e => setCode(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd} disabled={!name}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this client. This cannot be undone. If the client has linked projects or time entries, deletion will fail.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
