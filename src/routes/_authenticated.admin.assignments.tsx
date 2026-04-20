import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/assignments")({
  component: AdminAssignmentsPage,
});

function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<(Tables<"project_assignments"> & { profiles?: { full_name: string } | null; projects?: { name: string } | null })[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");

  const fetchAssignments = async () => {
    const { data } = await supabase.from("project_assignments").select("*").order("assigned_at", { ascending: false });
    if (!data) return;
    const [profRes, projRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("projects").select("id, name"),
    ]);
    const profMap = new Map((profRes.data || []).map(p => [p.user_id, p]));
    const projMap = new Map((projRes.data || []).map(p => [p.id, p]));
    setAssignments(data.map(a => ({
      ...a,
      profiles: profMap.get(a.user_id) ? { full_name: profMap.get(a.user_id)!.full_name } : null,
      projects: projMap.get(a.project_id) ? { name: projMap.get(a.project_id)!.name } : null,
    })));
  };

  useEffect(() => {
    fetchAssignments();
    supabase.from("profiles").select("*").eq("status", "active").then(({ data }) => data && setProfiles(data));
    supabase.from("projects").select("*").eq("status", "active").then(({ data }) => data && setProjects(data));
  }, []);

  const handleAdd = async () => {
    if (!userId || !projectId) return;
    await supabase.from("project_assignments").insert({ user_id: userId, project_id: projectId });
    setUserId(""); setProjectId(""); setDialogOpen(false);
    fetchAssignments();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("project_assignments").delete().eq("id", id);
    fetchAssignments();
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
                <TableHead>Project</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map(a => (
                <TableRow key={a.id}>
                  <TableCell>{a.profiles?.full_name || "—"}</TableCell>
                  <TableCell>{a.projects?.name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.assigned_at.slice(0, 10)}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Project</DialogTitle>
            <DialogDescription className="sr-only">Select a user and a project to create an assignment.</DialogDescription>
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
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAdd} disabled={!userId || !projectId}>Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
