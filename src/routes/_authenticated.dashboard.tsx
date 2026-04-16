import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTimer } from "@/hooks/use-timer";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { formatDuration, formatTimerDisplay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Play, Square, Clock, Plus, RotateCcw } from "lucide-react";
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

  const fetchData = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const [clientsRes, projectsRes, recentRes, todayRes, weekRes] = await Promise.all([
      supabase.from("clients").select("*").eq("status", "active").order("name"),
      supabase.from("projects").select("*").eq("status", "active").order("name"),
      supabase.from("time_entries").select("*, clients(name), projects(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
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

  const filteredProjects = selectedClient ? projects.filter(p => p.client_id === selectedClient) : projects;

  const handleStart = async () => {
    if (!selectedClient || !selectedProject) return;
    await startTimer(selectedClient, selectedProject);
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

  const handleContinue = async (entry: Tables<"time_entries">) => {
    await startTimer(entry.client_id, entry.project_id, entry.description || undefined);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your time tracking overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-2xl font-bold">{formatDuration(todayMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">This week</p>
            <p className="text-2xl font-bold">{formatDuration(weekMinutes)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Timer Card */}
      <Card className={activeEntry ? "border-timer/30 bg-timer/5" : ""}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {activeEntry ? "Timer running" : "Start timer"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeEntry ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-mono font-bold tracking-wider">{formatTimerDisplay(elapsed)}</p>
              </div>
              <Button size="lg" variant="destructive" onClick={handleStop} disabled={timerLoading} className="rounded-xl px-8">
                <Square className="h-4 w-4 mr-2" /> Stop
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedProject(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button size="lg" onClick={handleStart} disabled={!selectedClient || !selectedProject || timerLoading} className="rounded-xl px-8">
                  <Play className="h-4 w-4 mr-2" /> Start Timer
                </Button>
                <Button size="lg" variant="outline" onClick={() => setShowManual(!showManual)} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" /> Manual Entry
                </Button>
              </div>
            </>
          )}

          {showManual && !activeEntry && (
            <div className="space-y-3 pt-2 border-t">
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Minutes" value={manualDuration} onChange={(e) => setManualDuration(e.target.value)} />
                <Input placeholder="Description (optional)" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              </div>
              <Button onClick={handleManualEntry} disabled={!selectedClient || !selectedProject || !manualDuration}>Add Entry</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet. Start your first timer!</p>
          ) : (
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{entry.projects?.name || "—"}</p>
                    <p className="text-muted-foreground text-xs">{entry.clients?.name || "—"} · {entry.entry_date}</p>
                    {entry.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="font-mono text-xs px-2 py-1 rounded bg-background">{entry.duration_minutes ? formatDuration(entry.duration_minutes) : "running"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${entry.status === "approved" ? "bg-success/10 text-success" : entry.status === "submitted" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{entry.status}</span>
                    {!activeEntry && entry.duration_minutes && (
                      <Button size="sm" variant="ghost" onClick={() => handleContinue(entry)} title="Continue">
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
