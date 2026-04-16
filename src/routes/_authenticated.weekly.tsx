import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { startOfWeek, addDays, format, subWeeks, addWeeks, isWeekend } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/weekly")({
  component: WeeklyView,
});

const TARGET_DAY = 480;
const TARGET_WEEK = 2400;

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
  const weekPct = Math.min(100, (weekTotal / TARGET_WEEK) * 100);

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

  const getDayCellClass = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
    const total = getDayTotal(dateStr);
    const today = new Date();
    const isPast = d < today && format(d, "yyyy-MM-dd") !== format(today, "yyyy-MM-dd");
    if (isWeekend(d)) return "";
    if (isPast && total === 0) return "bg-destructive/8";
    if (isPast && total < TARGET_DAY) return "bg-warning/8";
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Weekly View</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Weekly target */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Week total</p>
            <p className="text-sm font-medium">{formatDuration(weekTotal)} <span className="text-muted-foreground font-normal">/ 40h</span></p>
          </div>
          <Progress value={weekPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium text-muted-foreground min-w-[160px]">Project</th>
                {days.map(d => (
                  <th key={d.toISOString()} className={`p-3 text-center font-medium text-muted-foreground min-w-[80px] ${isWeekend(d) ? "opacity-50" : ""}`}>
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
                  <tr key={pid} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="font-medium">{proj?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{proj?.clients?.name || ""}</p>
                    </td>
                    {days.map(d => {
                      const dateStr = format(d, "yyyy-MM-dd");
                      const mins = getMinutes(pid, dateStr);
                      return (
                        <td
                          key={d.toISOString()}
                          className={`p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors ${isWeekend(d) ? "opacity-50" : ""}`}
                          onClick={() => openAdd(dateStr)}
                        >
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
              <tr className="border-t bg-muted/20">
                <td className="p-3 font-medium text-sm">Day total</td>
                {days.map(d => {
                  const dateStr = format(d, "yyyy-MM-dd");
                  const dayTotal = getDayTotal(dateStr);
                  return (
                    <td key={d.toISOString()} className={`p-3 text-center ${getDayCellClass(d)}`}>
                      <div className={`font-mono font-medium text-xs ${!isWeekend(d) && dayTotal < TARGET_DAY && dayTotal > 0 ? "text-warning-foreground" : ""}`}>
                        {formatDuration(dayTotal)}
                      </div>
                      <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs px-2" onClick={() => openAdd(dateStr)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </td>
                  );
                })}
                <td className="p-3 text-center font-mono font-bold text-xs">{formatDuration(weekTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Mobile day-by-day view */}
      <div className="md:hidden space-y-3">
        {days.map(d => {
          const dateStr = format(d, "yyyy-MM-dd");
          const dayTotal = getDayTotal(dateStr);
          const dayEntries = entries.filter(e => e.entry_date === dateStr);
          return (
            <Card key={d.toISOString()} className={getDayCellClass(d)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{format(d, "EEEE")}</p>
                    <p className="text-xs text-muted-foreground">{format(d, "MMM d")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{formatDuration(dayTotal)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAdd(dateStr)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {dayEntries.length > 0 && (
                  <div className="space-y-1 mt-2 pt-2 border-t">
                    {dayEntries.map(e => {
                      const proj = projects.find(p => p.id === e.project_id);
                      return (
                        <div key={e.id} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate">{proj?.name || "—"}</span>
                          <span className="font-mono">{e.duration_minutes ? formatDuration(e.duration_minutes) : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add time — {dialogDate}</DialogTitle></DialogHeader>
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
