import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { adminResetPassword } from "@/server/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [profiles, setProfiles] = useState<(Tables<"profiles"> & { role?: string })[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [profRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      if (profRes.data && rolesRes.data) {
        const roleMap = new Map(rolesRes.data.map(r => [r.user_id, r.role]));
        setProfiles(profRes.data.map(p => ({ ...p, role: roleMap.get(p.user_id) || "freelancer" })));
      }
    };
    fetchData();
  }, []);

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
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell><Badge variant="secondary">{p.role}</Badge></TableCell>
                  <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                  <TableCell>{p.hourly_rate ? `$${p.hourly_rate}/hr` : "—"}</TableCell>
                  <TableCell>
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
                      <span className="ml-1">Reset Password</span>
                    </Button>
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
