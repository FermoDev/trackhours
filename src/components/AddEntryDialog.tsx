import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  defaultDate?: Date;
}

export function AddEntryDialog({ open, onOpenChange, onSaved, defaultDate }: AddEntryDialogProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [duration, setDuration] = useState("");
  const [unit, setUnit] = useState<"h" | "m">("h");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId("");
    setProjectId("");
    setDuration("");
    setDesc("");
    setUnit("h");
    setDate(defaultDate ?? new Date());
    supabase.from("clients").select("*").eq("status", "active").order("name").then(({ data }) => data && setClients(data));
    supabase.from("projects").select("*").eq("status", "active").order("name").then(({ data }) => data && setProjects(data));
  }, [open, defaultDate]);

  const filteredProjects = clientId ? projects.filter(p => p.client_id === clientId) : projects;

  const save = async () => {
    if (!user || !clientId || !projectId || !duration) return;
    const mins = unit === "h" ? Math.round(parseFloat(duration) * 60) : parseInt(duration);
    if (isNaN(mins) || mins <= 0) return;
    setSaving(true);
    const { error } = await supabase.from("time_entries").insert({
      user_id: user.id,
      client_id: clientId,
      project_id: projectId,
      entry_date: format(date, "yyyy-MM-dd"),
      duration_minutes: mins,
      description: desc.trim() || null,
      entry_mode: "manual" as const,
      billable: true,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to add entry");
      return;
    }
    toast.success("Entry added");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add time entry</DialogTitle>
          <DialogDescription className="sr-only">Manually log time for a client and project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client <span className="text-destructive">*</span></Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No clients yet</p>}
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Project <span className="text-destructive">*</span></Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">{clientId ? "No projects for this client" : "Select a client first"}</p>}
                  {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} disabled={(d) => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step={unit === "h" ? "0.25" : "1"}
                  min="0"
                  placeholder={unit === "h" ? "Hours" : "Minutes"}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="flex-1"
                />
                <Select value={unit} onValueChange={(v) => setUnit(v as "h" | "m")}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h">Hours</SelectItem>
                    <SelectItem value="m">Minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              placeholder="What did you work on?"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!clientId || !projectId || !duration || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? "Adding…" : "Add entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
