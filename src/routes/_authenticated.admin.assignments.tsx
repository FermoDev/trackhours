import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/assignments")({
  component: AdminAssignmentsPage,
});

type AssignmentRow = Tables<"client_assignments"> & {
  profileName?: string;
  clientName?: string;
};

function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAssignments = async () => {
    const { data } = await supabase.from("client_assignments").select("*").order("assigned_at", { ascending: false });
    if (!data) return;
    const [profRes, cliRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("clients").select("id, name"),
    ]);
    const profMap = new Map((profRes.data || []).map(p => [p.user_id, p.full_name]));
    const cliMap = new Map((cliRes.data || []).map(c => [c.id, c.name]));
    setAssignments(data.map(a => ({
      ...a,
      profileName: profMap.get(a.user_id) || undefined,
      clientName: cliMap.get(a.client_id) || undefined,
    })));
  };

  useEffect(() => {
    fetchAssignments();
    supabase.from("profiles").select("*").eq("status", "active").then(({ data }) => data && setProfiles(data));
    supabase.from("clients").select("*").eq("status", "active").order("name").then(({ data }) => data && setClients(data));
  }, []);

  const handleAdd = async () => {
    if (!userId || !clientId) return;
    setAdding(true);
    await supabase.from("client_assignments").insert({ user_id: userId, client_id: clientId });
    setUserId(""); setClientId(""); setDialogOpen(false);
    await fetchAssignments();
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from("client_assignments").delete().eq("id", id);
    await fetchAssignments();
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        <Button onClick={() => setDialogOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />Assign</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map(a => (
                <TableRow key={a.id}>
                  <TableCell>{a.profileName || "—"}</TableCell>
                  <TableCell>{a.clientName || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.assigned_at.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" disabled={deletingId === a.id} onClick={() => handleDelete(a.id)}>
                      {deletingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
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
            <DialogTitle>Assign User to Client</DialogTitle>
            <DialogDescription className="sr-only">Select a user and a client to create an assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={!userId || !clientId || adding}>
              {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {adding ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
