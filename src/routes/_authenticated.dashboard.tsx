import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTimer } from "@/hooks/use-timer";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { formatDuration, formatTimerDisplay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Play, Square, Clock, Plus, RotateCcw, Zap, Pause, CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { useServerFn } from "@tanstack/react-start";
import { findOrCreateClient, findOrCreateProject, deleteProject, deleteClient } from "@/lib/clients.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: FreelancerDashboard,
});

function FreelancerDashboard() {
  const { profile, user } = useAuth();
  const { activeEntry, elapsed, startTimer, stopTimer, pauseTimer, resumeTimer, isPaused, isLoading: timerLoading } = useTimer();
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [recentEntries, setRecentEntries] = useState<(Tables<"time_entries"> & { clients: { name: string } | null; projects: { name: string } | null })[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [manualDuration, setManualDuration] = useState("");
  const [manualUnit, setManualUnit] = useState<"h" | "m">("h");
  const [manualDesc, setManualDesc] = useState("");
  const [showFullStart, setShowFullStart] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [addProjectClientId, setAddProjectClientId] = useState("");
  const [manualDate, setManualDate] = useState<Date>(new Date());
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [pendingQuickStart, setPendingQuickStart] = useState<string | null>(null);
  const [timerDesc, setTimerDesc] = useState("");
  const findOrCreateClientFn = useServerFn(findOrCreateClient);
  const findOrCreateProjectFn = useServerFn(findOrCreateProject);
  const deleteProjectFn = useServerFn(deleteProject);
  const deleteClientFn = useServerFn(deleteClient);
  const [deleting, setDeleting] = useState<string | null>(null);

  const myProjects = useMemo(
    () => projects.filter(p => p.created_by === user?.id),
    [projects, user?.id]
  );
  const myClients = useMemo(
    () => clients.filter(c => c.created_by === user?.id),
    [clients, user?.id]
  );

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? All your time entries on it will also be removed.`)) return;
    setDeleting(id);
    const res = await deleteProjectFn({ data: { projectId: id } });
    setDeleting(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Project deleted");
    fetchData();
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`Delete client "${name}"? All its projects and your time entries will also be removed.`)) return;
    setDeleting(id);
    const res = await deleteClientFn({ data: { clientId: id } });
    setDeleting(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Client deleted");
    fetchData();
  };

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
    if (!selectedClient || !selectedProject || !timerDesc.trim()) return;
    await startTimer(selectedClient, selectedProject, timerDesc.trim());
    setTimerDesc("");
    setShowFullStart(false);
  };

  const handleStop = async () => {
    await stopTimer();
    fetchData();
  };

  const handleManualEntry = async () => {
    if (!user || !selectedClient || !selectedProject || !manualDuration || !manualDesc.trim()) return;
    const mins = manualUnit === "h"
      ? Math.round(parseFloat(manualDuration) * 60)
      : parseInt(manualDuration);
    if (isNaN(mins) || mins <= 0) return;
    setSubmittingManual(true);
    await supabase.from("time_entries").insert({
      user_id: user.id,
      client_id: selectedClient,
      project_id: selectedProject,
      entry_date: format(manualDate, "yyyy-MM-dd"),
      duration_minutes: mins,
      description: manualDesc.trim(),
      entry_mode: "manual" as const,
      billable: true,
    });
    setManualDuration("");
    setManualDesc("");
    setShowManual(false);
    setManualDate(new Date());
    await fetchData();
    setSubmittingManual(false);
  };

  const handleQuickStart = (clientId: string, projectId: string) => {
    // Open the start dialog pre-filled so user must enter a description
    setSelectedClient(clientId);
    setSelectedProject(projectId);
    setTimerDesc("");
    setShowFullStart(true);
    setShowManual(false);
  };

  const handleAddProject = async () => {
    const clientId = addProjectClientId || selectedClient;
    if (!newProjectName.trim() || !clientId) return;
    setSavingProject(true);
    try {
      const result = await findOrCreateProjectFn({
        data: {
          clientId,
          name: newProjectName.trim(),
        },
      });
      if (!result.success) {
        toast.error(result.error || "Failed to add project");
        return;
      }
      setNewProjectName("");
      setAddProjectOpen(false);
      setAddProjectClientId("");
      toast.success(result.status === "created" ? "Project created" : "Joined existing project");
      await fetchData();
      setSelectedClient(clientId);
      setSelectedProject(result.id);
      setShowFullStart(true);
      setShowManual(false);
    } catch (err) {
      console.error("Add project failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add project. Please try signing in again.");
    } finally {
      setSavingProject(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    setSavingClient(true);
    try {
      const result = await findOrCreateClientFn({
        data: {
          name: newClientName.trim(),
        },
      });
      if (!result.success) {
        toast.error(result.error || "Failed to add client");
        return;
      }
      setNewClientName("");
      setAddClientOpen(false);
      toast.success(result.status === "created" ? "Client added" : "Joined existing client");
      await fetchData();
      setSelectedClient(result.id);
      setSelectedProject("");
      setShowFullStart(true);
      setShowManual(false);
    } catch (err) {
      console.error("Add client failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add client. Please try signing in again.");
    } finally {
      setSavingClient(false);
    }
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

      {/* Quick add — always available */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setAddClientOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New client
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setAddProjectClientId(""); setAddProjectOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New project
        </Button>
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
                      {pendingQuickStart === `${rp.clientId}:${rp.projectId}` ? (
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3 mr-1.5" />
                      )}
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
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Manual entry
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
                <Clock className={cn("h-5 w-5 text-timer", !isPaused && "animate-pulse")} />
                <div>
                  <p className="text-3xl font-mono font-bold tracking-wider tabular-nums">{formatTimerDisplay(elapsed)}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {activeEntry.projectName} · {activeEntry.clientName}
                    {isPaused && <span className="ml-2 text-xs font-medium text-warning">Paused</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="lg" variant="outline" onClick={isPaused ? resumeTimer : pauseTimer} disabled={timerLoading} className="rounded-xl">
                  {timerLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : isPaused ? (
                    <><Play className="h-4 w-4 mr-2" /> Resume</>
                  ) : (
                    <><Pause className="h-4 w-4 mr-2" /> Pause</>
                  )}
                  {timerLoading && (isPaused ? "Resume" : "Pause")}
                </Button>
                <Button size="lg" variant="destructive" onClick={handleStop} disabled={timerLoading} className="rounded-xl px-8">
                  {timerLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
                  Stop
                </Button>
              </div>
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
              <div className="flex gap-1.5">
                <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedProject(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No clients yet</p>}
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => setAddClientOpen(true)} title="Add client"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex gap-1.5">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">{selectedClient ? "No projects for this client" : "Select a client first"}</p>}
                    {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => { setAddProjectClientId(selectedClient); setAddProjectOpen(true); }} disabled={!selectedClient} title="Add project"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">What are you working on? <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Describe the task you're about to work on…"
                value={timerDesc}
                onChange={(e) => setTimerDesc(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={handleStart} disabled={!selectedClient || !selectedProject || !timerDesc.trim() || timerLoading} className="rounded-xl">
              {timerLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Start Timer
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
              <div className="flex gap-1.5">
                <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedProject(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No clients yet</p>}
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => setAddClientOpen(true)} title="Add client"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex gap-1.5">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">{selectedClient ? "No projects for this client" : "Select a client first"}</p>}
                    {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => { setAddProjectClientId(selectedClient); setAddProjectOpen(true); }} disabled={!selectedClient} title="Add project"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !manualDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(manualDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={manualDate} onSelect={(d) => d && setManualDate(d)} disabled={(date) => date > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step={manualUnit === "h" ? "0.25" : "1"}
                  min="0"
                  placeholder={manualUnit === "h" ? "Hours" : "Minutes"}
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  className="flex-1"
                />
                <Select value={manualUnit} onValueChange={(v) => setManualUnit(v as "h" | "m")}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h">Hours</SelectItem>
                    <SelectItem value="m">Minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="What did you work on?"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={handleManualEntry} disabled={!selectedClient || !selectedProject || !manualDuration || !manualDesc.trim() || submittingManual} className="rounded-xl">
              {submittingManual && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submittingManual ? "Adding…" : "Add Entry"}
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
                    <p className="font-medium text-sm truncate">{entry.projects?.name || "—"}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{entry.clients?.name || "—"} · {entry.entry_date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs tabular-nums">{entry.duration_minutes ? formatDuration(entry.duration_minutes) : "running"}</span>
                    {!activeEntry && entry.duration_minutes && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleQuickStart(entry.client_id, entry.project_id)} title="Continue">
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                    {entry.duration_minutes && (
                      <DeleteEntryButton entryId={entry.id} onDeleted={fetchData} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Project Dialog */}
      <Dialog open={addProjectOpen} onOpenChange={(o) => {
        setAddProjectOpen(o);
        if (!o) {
          setNewProjectName("");
          setSavingProject(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
            <DialogDescription className="sr-only">Quickly create a new project under the selected client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={addProjectClientId} onValueChange={setAddProjectClientId}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No clients yet — add one first</p>}
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project name</Label>
              <Input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="e.g. Website Redesign" />
              <p className="text-xs text-muted-foreground">If a project with this name already exists for the client, you'll join it.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => handleAddProject()} disabled={!newProjectName.trim() || !addProjectClientId || savingProject}>
              {savingProject && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {savingProject ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientOpen} onOpenChange={(o) => {
        setAddClientOpen(o);
        if (!o) {
          setNewClientName("");
          setSavingClient(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription className="sr-only">Add a new client or join an existing one by name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Client name</Label>
              <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="e.g. Acme Inc" autoFocus />
              <p className="text-xs text-muted-foreground">If a client with this name already exists, you'll join it.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => handleAddClient()} disabled={!newClientName.trim() || savingClient}>
              {savingClient && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {savingClient ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
