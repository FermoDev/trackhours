import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getUserStats } from "@/server/admin.functions";
import { authHeaders } from "@/lib/server-auth";
import { formatDuration } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type AppRole = "admin" | "freelancer" | "manager";
type Profile = Tables<"profiles"> & { role: AppRole };

interface Stats {
  totals: { today: number; week: number; month: number; allTime: number; billableMinutes: number };
  topClients: { id: string; name: string; minutes: number }[];
  topProjects: { id: string; name: string; clientName: string; minutes: number }[];
  recentEntries: {
    id: string;
    entry_date: string;
    duration_minutes: number;
    description: string | null;
    clientName: string;
    projectName: string;
  }[];
}

export function UserStatsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: Profile | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const getUserStatsFn = useServerFn(getUserStats);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    setStats(null);
    setError(null);
    (async () => {
      try {
        const headers = await authHeaders();
        const result = await getUserStatsFn({ data: { userId: user.user_id }, headers });
        if (cancelled) return;
        if (result.success) setStats(result.stats);
        else setError(result.error || "Failed to load stats");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, getUserStatsFn]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user?.full_name || user?.email || "User"} — Activity</DialogTitle>
          <DialogDescription>
            <span className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{user?.email}</span>
              {user?.role && <Badge variant="outline">{user.role}</Badge>}
              {user?.status && (
                <Badge variant={user.status === "active" ? "default" : "secondary"}>{user.status}</Badge>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
        )}

        {stats && !loading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Today", value: stats.totals.today },
                { label: "This week", value: stats.totals.week },
                { label: "This month", value: stats.totals.month },
                { label: "All time", value: stats.totals.allTime },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold font-mono mt-1">{formatDuration(s.value)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Top clients (90d)
                  </p>
                  {stats.topClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No activity</p>
                  ) : (
                    <ul className="divide-y">
                      {stats.topClients.map((c) => (
                        <li key={c.id} className="flex justify-between py-1.5 text-sm">
                          <span className="truncate">{c.name}</span>
                          <span className="font-mono text-xs">{formatDuration(c.minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Top projects (90d)
                  </p>
                  {stats.topProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No activity</p>
                  ) : (
                    <ul className="divide-y">
                      {stats.topProjects.map((p) => (
                        <li key={p.id} className="flex justify-between py-1.5 text-sm gap-2">
                          <span className="truncate min-w-0">
                            <span className="font-medium">{p.name}</span>
                            {p.clientName && (
                              <span className="text-xs text-muted-foreground"> · {p.clientName}</span>
                            )}
                          </span>
                          <span className="font-mono text-xs shrink-0">{formatDuration(p.minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Recent entries
                </p>
                {stats.recentEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No entries yet</p>
                ) : (
                  <ul className="divide-y">
                    {stats.recentEntries.map((e) => (
                      <li key={e.id} className="flex items-center justify-between py-2 text-sm gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate">
                            <span className="font-medium">{e.projectName}</span>
                            <span className="text-xs text-muted-foreground"> · {e.clientName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{e.entry_date}</p>
                        </div>
                        <span className="font-mono text-xs">{formatDuration(e.duration_minutes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}