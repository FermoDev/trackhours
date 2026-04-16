import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTimer } from "@/hooks/use-timer";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { formatDuration, formatTimerDisplay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Play, Square, Clock, Plus, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: FreelancerDashboard,
});

function FreelancerDashboard() {
  const { profile, user } = useAuth();
  const { activeEntry, elapsed, startTimer, stopTimer, isLoading: timerLoading } = useTimer();
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [recentEntries, setRecentEntries] = useState<(Tables<"time_entries"> & { clients: { name: string } | null; projects: { name: string } | null })[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [manualDuration, setManualDuration] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [showFullStart, setShowFullStart] = useState(false);

  const TARGET_DAY = 480; // 8h
  const TARGET_WEEK = 2400; // 40h

  const fetchData = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const [clientsRes, projectsRes, recentRes, todayRes, weekRes] = await Promise.all([
      supabase.from("clients").select("*").eq("status", "active").order("name"),
      supabase.from("projects").select("*").eq("status", "active").order("name"),
      supabase.from("time_entries").select("*, clients(name), projects(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("time_entries").select("duration_minutes").eq("user_id", user.id).eq("entry_date", today).not("duration_minutes", "is", null),
      supabase.from("time_entries").select("duration_minutes").eq("user_id", user.id).gte("entry_date", weekStartStr).not("duration_minutes", "is", null),
    ]);

    if (clientsRes.data) setClients(clientsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (recentRes.data) setRecentEntries(recentRes.data as any);
    setTodayMinutes(todayRes.data?.reduce((s, e) => s + (e.duration_minutes || 0), 0) || 0);
    setWeekMinutes(weekRes.data?.reduce((s, e) => s + (e.duration_minutes || 0), 0) || 0);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derive recent unique project combos for quick start
  const recentProjects = useMemo(() => {
    const seen = new Set<string>();
    const result: { clientId: string; projectId: string; clientName: string; projectName: string }[] = [];
    for (const e of recentEntries) {
      const key = `${e.client_id}:${e.project_id}`;
      if (seen.has(key) || !e.duration_minutes) continue;
      seen.add(key);
      result.push({
        clientId: e.client_id,
        projectId: e.project_id,
        clientName: e.clients?.name || "—",
        projectName: e.projects?.name || "—",
      });
      if (result.length >= 4) break;
    }
    return result;
  }, [recentEntries]);

  const lastEntry = recentEntries.find(e => e.duration_minutes);

  const filteredProjects = selectedClient ? projects.filter(p => p.client_id === selectedClient) : projects;

  const handleStart = async () => {
    if (!selectedClient || !selectedProject) return;
    await startTimer(selectedClient, selectedProject);
    setShowFullStart(false);
  };

  const handleStop = async () => {
    await stopTimer();
    fetchData();
  };

  const handleManualEntry = async () => {
    if (!user || !selectedClient || !selectedProject || !manualDuration) return;
    const mins = parseInt(manualDuration);
    if (isNaN(mins) || mins <= 0) return;
    await supabase.from("time_entries").insert({
      user_id: user.id,
      client_id: selectedClient,
      project_id: selectedProject,
      entry_date: new Date().toISOString().slice(0, 10),
      duration_minutes: mins,
      description: manualDesc || null,
      entry_mode: "manual" as const,
      billable: true,
      status: "draft" as const,
    });
    setManualDuration("");
    setManualDesc("");
    setShowManual(false);
    fetchData();
  };

  const handleQuickStart = async (clientId: string, projectId: string) => {
    await startTimer(clientId, projectId);
  };

  const todayPct = Math.min(100, (todayMinutes / TARGET_DAY) * 100);
  const weekPct = Math.min(100, (weekMinutes / TARGET_WEEK) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your time tracking overview</p>
      </div>

      {/* Hours targets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-sm font-medium">{formatDuration(todayMinutes)} <span className="text-muted-foreground font-normal">/ 8h</span></p>
            </div>
            <Progress value={todayPct} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">This week</p>
              <p className="text-sm font-medium">{formatDuration(weekMinutes)} <span className="text-muted-foreground font-normal">/ 40h</span></p>
            </div>
            <Progress value={weekPct} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Quick actions — only when no timer running */}
      {!activeEntry && (
        <div className="space-y-3">
          {/* Continue last + Quick start from recent */}
          {recentProjects.length > 0 && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick start</p>
                <div className="flex flex-wrap gap-2">
                  {recentProjects.map((rp, i) => (
                    <Button
                      key={`${rp.clientId}:${rp.projectId}`}
                      variant={i === 0 ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl"
                      disabled={timerLoading}
                      onClick={() => handleQuickStart(rp.clientId, rp.projectId)}
                    >
                      <Play className="h-3 w-3 mr-1.5" />
                      {rp.projectName}
                      <span className="text-xs opacity-70 ml-1">· {rp.clientName}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other actions row */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setShowFullStart(true); setShowManual(false); }}>
              <Zap className="h-3.5 w-3.5 mr-1.5" /> New project timer
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setShowManual(true); setShowFullStart(false); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Forgot to track?
            </Button>
          </div>
        </div>
      )}

      {/* Active timer display */}
      {activeEntry && (
        <Card className="border-timer/30 bg-timer/5">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-timer" />
                <div>
                  <p className="text-3xl font-mono font-bold tracking-wider tabular-nums">{formatTimerDisplay(elapsed)}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {activeEntry.projectName} · {activeEntry.clientName}
                  </p>
                </div>
              </div>
              <Button size="lg" variant="destructive" onClick={handleStop} disabled={timerLoading} className="rounded-xl px-8">
                <Square className="h-4 w-4 mr-2" /> Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full start form — toggled */}
      {showFullStart && !activeEntry && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Start a new timer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedProject(""); }}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No clients yet</p>}
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No projects available</p>}
                  {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleStart} disabled={!selectedClient || !selectedProject || timerLoading} className="rounded-xl">
              <Play className="h-4 w-4 mr-2" /> Start Timer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manual entry form — toggled */}
      {showManual && !activeEntry && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add manual entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedProject(""); }}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No clients yet</p>}
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No projects available</p>}
                  {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Minutes" value={manualDuration} onChange={(e) => setManualDuration(e.target.value)} />
              <Input placeholder="Description (optional)" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
            </div>
            <Button onClick={handleManualEntry} disabled={!selectedClient || !selectedProject || !manualDuration} className="rounded-xl">
              Add Entry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No entries yet. Start your first timer!</p>
          ) : (
            <div className="divide-y">
              {recentEntries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{entry.projects?.name || "—"}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${entry.status === "approved" ? "bg-success/10 text-success" : entry.status === "submitted" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{entry.status}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">{entry.clients?.name || "—"} · {entry.entry_date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs tabular-nums">{entry.duration_minutes ? formatDuration(entry.duration_minutes) : "running"}</span>
                    {!activeEntry && entry.duration_minutes && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleQuickStart(entry.client_id, entry.project_id)} title="Continue">
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
