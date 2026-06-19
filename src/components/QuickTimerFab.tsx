import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Play, Loader2 } from "lucide-react";
import { useTimer } from "@/hooks/use-timer";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export function QuickTimerFab() {
  const { user } = useAuth();
  const { activeEntry, startTimer, isLoading } = useTimer();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (!user || !open) return;
    supabase.from("clients").select("*").eq("status", "active").order("name")
      .then(({ data }) => data && setClients(data));
    supabase.from("projects").select("*").eq("status", "active").order("name")
      .then(({ data }) => data && setProjects(data));
  }, [user, open]);

  if (activeEntry) return null;

  const filteredProjects = clientId ? projects.filter(p => p.client_id === clientId) : projects;

  const onStart = async () => {
    if (!clientId || !projectId) return;
    await startTimer(clientId, projectId, desc || undefined);
    setOpen(false);
    setClientId(""); setProjectId(""); setDesc("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-[var(--shadow-float)] z-30 hover:scale-105 active:scale-95 transition-transform"
          aria-label="Start a quick timer"
        >
          <Play className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 space-y-3">
        <p className="text-sm font-medium">Quick timer</p>
        <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); }}>
          <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId} disabled={!clientId}>
          <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>{filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
        <Button onClick={onStart} disabled={!clientId || !projectId || isLoading} className="w-full">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          Start timer
        </Button>
      </PopoverContent>
    </Popover>
  );
}