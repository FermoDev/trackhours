import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { mergeClients } from "@/lib/clients.functions";
import { DownloadClientTimesheetDialog } from "@/components/DownloadClientTimesheetDialog";

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
  const [mergeSource, setMergeSource] = useState<Tables<"clients"> | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<Tables<"clients"> | null>(null);
  const mergeClientsFn = useServerFn(mergeClients);

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
    setAdding(true);
    await supabase.from("clients").insert({ name, code: code || null });
    setName(""); setCode(""); setDialogOpen(false);
    await fetchClients();
    setAdding(false);
  };

  const toggleStatus = async (client: Tables<"clients">) => {
    setTogglingId(client.id);
    await supabase.from("clients").update({ status: client.status === "active" ? "inactive" as const : "active" as const }).eq("id", client.id);
    await fetchClients();
    setTogglingId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("clients").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Cannot delete — client may have linked projects or entries"); }
    else { toast.success("Client deleted"); }
    setDeleteTarget(null);
    await fetchClients();
    setDeleting(false);
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setMerging(true);
    const result = await mergeClientsFn({ data: { sourceId: mergeSource.id, targetId: mergeTargetId } });
    setMerging(false);
    if (!result.success) {
      toast.error(result.error || "Merge failed");
      return;
    }
    toast.success("Clients merged");
    setMergeSource(null);
    setMergeTargetId("");
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
                      {togglingId === c.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      <Button variant="ghost" size="sm" onClick={() => { setMergeSource(c); setMergeTargetId(""); }}>Merge</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Download timesheet" onClick={() => setDownloadTarget(c)}><Download className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription className="sr-only">Create a new client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Code (optional)</Label><Input value={code} onChange={e => setCode(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={!name || adding}>
              {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {adding ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this client, along with all its projects and time entries. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!mergeSource} onOpenChange={(o) => { if (!o) { setMergeSource(null); setMergeTargetId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge "{mergeSource?.name}" into…</DialogTitle>
            <DialogDescription>All projects, time entries, and assignments from "{mergeSource?.name}" will be moved to the target client. "{mergeSource?.name}" will then be deleted. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Target client</Label>
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger><SelectValue placeholder="Select target client" /></SelectTrigger>
              <SelectContent>
                {clients.filter(c => c.id !== mergeSource?.id).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
      <DownloadClientTimesheetDialog client={downloadTarget} onClose={() => setDownloadTarget(null)} />
    </div>
  );
}
