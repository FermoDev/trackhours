import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, KeyRound, Loader2, Power, Trash2, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import {
  adminResetPassword,
  adminUpdateUserRole,
  adminSetUserStatus,
  adminDeleteUser,
} from "@/server/admin.functions";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

type AppRole = "admin" | "freelancer" | "manager";

function AdminUsersPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<(Tables<"profiles"> & { role: AppRole })[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clientDialogUser, setClientDialogUser] = useState<(Tables<"profiles"> & { role: AppRole }) | null>(null);
  const [userClients, setUserClients] = useState<Tables<"client_assignments">[]>([]);
  const [allClients, setAllClients] = useState<Tables<"clients">[]>([]);
  const [addingClientId, setAddingClientId] = useState("");

  const fetchData = useCallback(async () => {
    const [profRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
    ]);
    if (profRes.data && rolesRes.data) {
      const roleMap = new Map(rolesRes.data.map(r => [r.user_id, r.role]));
      const merged = profRes.data.map(p => ({
        ...p,
        role: (roleMap.get(p.user_id) || "freelancer") as AppRole,
      }));
      // Admins first, then by name
      merged.sort((a, b) => {
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (a.role !== "admin" && b.role === "admin") return 1;
        return (a.full_name || "").localeCompare(b.full_name || "");
      });
      setProfiles(merged);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    supabase.from("clients").select("*").eq("status", "active").order("name").then(({ data }) => data && setAllClients(data));
  }, []);

  const openClientDialog = async (profile: Tables<"profiles"> & { role: AppRole }) => {
    setClientDialogUser(profile);
    const { data } = await supabase.from("client_assignments").select("*").eq("user_id", profile.user_id);
    setUserClients(data || []);
  };

  const addClientAssignment = async () => {
    if (!clientDialogUser || !addingClientId) return;
    await supabase.from("client_assignments").insert({ user_id: clientDialogUser.user_id, client_id: addingClientId });
    setAddingClientId("");
    const { data } = await supabase.from("client_assignments").select("*").eq("user_id", clientDialogUser.user_id);
    setUserClients(data || []);
  };

  const removeClientAssignment = async (id: string) => {
    if (!clientDialogUser) return;
    await supabase.from("client_assignments").delete().eq("id", id);
    const { data } = await supabase.from("client_assignments").select("*").eq("user_id", clientDialogUser.user_id);
    setUserClients(data || []);
  };

  const handleResetPassword = async (profile: Tables<"profiles">) => {
    setResettingId(profile.id);
    try {
      const result = await adminResetPassword({ data: { email: profile.email } });
      if (result.success) {
        toast.success(`Password reset email sent to ${profile.email}`);
      } else {
        toast.error(result.error || "Failed to send reset email");
      }
    } catch {
      toast.error("Failed to send reset email");
    } finally {
      setResettingId(null);
    }
  };

  const handleRoleChange = async (userId: string, role: AppRole) => {
    setBusyId(userId);
    try {
      const result = await adminUpdateUserRole({ data: { userId, role } });
      if (result.success) {
        toast.success(`Role updated to ${role}`);
        await fetchData();
      } else {
        toast.error(result.error || "Failed to update role");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    setBusyId(userId);
    const next = currentStatus === "active" ? "inactive" : "active";
    try {
      const result = await adminSetUserStatus({ data: { userId, status: next } });
      if (result.success) {
        toast.success(next === "inactive" ? "User disabled" : "User enabled");
        await fetchData();
      } else {
        toast.error(result.error || "Failed to update status");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setBusyId(userId);
    try {
      const result = await adminDeleteUser({ data: { userId } });
      if (result.success) {
        toast.success("User deleted");
        await fetchData();
      } else {
        toast.error(result.error || "Failed to delete user");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Users</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map(p => {
                const isSelf = p.user_id === user?.id;
                const isBusy = busyId === p.user_id;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.full_name || "—"}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>
                      <Select
                        value={p.role}
                        onValueChange={(v) => handleRoleChange(p.user_id, v as AppRole)}
                        disabled={isSelf || isBusy}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="manager">manager</SelectItem>
                          <SelectItem value="freelancer">freelancer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === "active" ? "default" : "secondary"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.hourly_rate ? `$${p.hourly_rate}/hr` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openClientDialog(p)}
                          title="Manage client assignments"
                        >
                          <Building2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetPassword(p)}
                          disabled={resettingId === p.id}
                          title="Send password reset email"
                        >
                          {resettingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSelf || isBusy}
                              title={p.status === "active" ? "Disable user" : "Enable user"}
                            >
                              <Power className={`h-4 w-4 ${p.status === "inactive" ? "text-muted-foreground" : ""}`} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {p.status === "active" ? "Disable user?" : "Enable user?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {p.status === "active"
                                  ? `${p.email} will no longer be able to sign in.`
                                  : `${p.email} will regain access and be able to sign in again.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleToggleStatus(p.user_id, p.status)}>
                                {p.status === "active" ? "Disable" : "Enable"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSelf || isBusy}
                              title="Delete user"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Permanently delete {p.email} and all their time entries? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(p.user_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!clientDialogUser} onOpenChange={(open) => !open && setClientDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client assignments — {clientDialogUser?.full_name || clientDialogUser?.email}</DialogTitle>
            <DialogDescription className="sr-only">Manage which clients are assigned to this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {userClients.length === 0 && <p className="text-sm text-muted-foreground">No clients assigned.</p>}
              {userClients.map(ca => {
                const client = allClients.find(c => c.id === ca.client_id);
                return (
                  <Badge key={ca.id} variant="secondary" className="gap-1 pr-1">
                    {client?.name || "Unknown"}
                    <button onClick={() => removeClientAssignment(ca.id)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Select value={addingClientId} onValueChange={setAddingClientId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Add a client…" /></SelectTrigger>
                <SelectContent>
                  {allClients.filter(c => !userClients.some(uc => uc.client_id === c.id)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addClientAssignment} disabled={!addingClientId} size="sm">Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
