import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { startOfWeek, addDays, format, subWeeks, addWeeks } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/weekly")({
  component: WeeklyView,
});

function WeeklyView() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [entries, setEntries] = useState<Tables<"time_entries">[]>([]);
  const [projects, setProjects] = useState<(Tables<"projects"> & { clients: { name: string } | null })[]>([]);
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState("");
  const [dialogProject, setDialogProject] = useState("");
  const [dialogClient, setDialogClient] = useState("");
  const [dialogMinutes, setDialogMinutes] = useState("");
  const [dialogDesc, setDialogDesc] = useState("");

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    if (!user) return;
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const [entriesRes, projectsRes, clientsRes] = await Promise.all([
      supabase.from("time_entries").select("*").eq("user_id", user.id).gte("entry_date", from).lte("entry_date", to),
      supabase.from("projects").select("*, clients(name)").eq("status", "active"),
      supabase.from("clients").select("*").eq("status", "active"),
    ]);
    setEntries(entriesRes.data || []);
    setProjects((projectsRes.data as any) || []);
    setClients(clientsRes.data || []);
  }, [user, weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const projectIds = [...new Set(entries.map(e => e.project_id))];
  const getMinutes = (projectId: string, date: string) =>
    entries.filter(e => e.project_id === projectId && e.entry_date === date).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const getDayTotal = (date: string) => entries.filter(e => e.entry_date === date).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const weekTotal = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  const openAdd = (date: string) => {
    setDialogDate(date);
    setDialogProject("");
    setDialogClient("");
    setDialogMinutes("");
    setDialogDesc("");
    setDialogOpen(true);
  };

  const saveEntry = async () => {
    if (!user || !dialogClient || !dialogProject || !dialogMinutes) return;
    await supabase.from("time_entries").insert({
      user_id: user.id,
      client_id: dialogClient,
      project_id: dialogProject,
      entry_date: dialogDate,
      duration_minutes: parseInt(dialogMinutes),
      description: dialogDesc || null,
      entry_mode: "manual" as const,
      billable: true,
      status: "draft" as const,
    });
    setDialogOpen(false);
    fetchData();
  };

  const filteredProjects = dialogClient ? projects.filter(p => p.client_id === dialogClient) : projects;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Weekly View</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium text-muted-foreground min-w-[160px]">Project</th>
                {days.map(d => (
                  <th key={d.toISOString()} className="p-3 text-center font-medium text-muted-foreground min-w-[80px]">
                    <div>{format(d, "EEE")}</div>
                    <div className="text-xs">{format(d, "MMM d")}</div>
                  </th>
                ))}
                <th className="p-3 text-center font-medium text-muted-foreground min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {projectIds.map(pid => {
                const proj = projects.find(p => p.id === pid);
                const rowTotal = days.reduce((s, d) => s + getMinutes(pid, format(d, "yyyy-MM-dd")), 0);
                return (
                  <tr key={pid} className="border-b">
                    <td className="p-3">
                      <p className="font-medium">{proj?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{proj?.clients?.name || ""}</p>
                    </td>
                    {days.map(d => {
                      const mins = getMinutes(pid, format(d, "yyyy-MM-dd"));
                      return (
                        <td key={d.toISOString()} className="p-3 text-center">
                          <span className="font-mono text-xs">{mins > 0 ? formatDuration(mins) : "—"}</span>
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-mono font-medium text-xs">{formatDuration(rowTotal)}</td>
                  </tr>
                );
              })}
              {projectIds.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No entries this week</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td className="p-3 font-medium">Day total</td>
                {days.map(d => (
                  <td key={d.toISOString()} className="p-3 text-center">
                    <div className="font-mono font-medium text-xs">{formatDuration(getDayTotal(format(d, "yyyy-MM-dd")))}</div>
                    <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs" onClick={() => openAdd(format(d, "yyyy-MM-dd"))}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </td>
                ))}
                <td className="p-3 text-center font-mono font-bold text-xs">{formatDuration(weekTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add time entry — {dialogDate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={dialogClient} onValueChange={(v) => { setDialogClient(v); setDialogProject(""); }}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={dialogProject} onValueChange={setDialogProject}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Minutes" value={dialogMinutes} onChange={e => setDialogMinutes(e.target.value)} />
            <Input placeholder="Description (optional)" value={dialogDesc} onChange={e => setDialogDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={saveEntry} disabled={!dialogClient || !dialogProject || !dialogMinutes}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
