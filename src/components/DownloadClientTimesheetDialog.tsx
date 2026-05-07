import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { exportClientTimesheet } from "@/lib/exportClientTimesheet";

type Preset = "this_month" | "last_month" | "this_week" | "all_time" | "custom";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(p: Preset, customFrom: string, customTo: string): { from?: string; to?: string } {
  const now = new Date();
  if (p === "all_time") return {};
  if (p === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(start), to: fmt(end) };
  }
  if (p === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(start), to: fmt(end) };
  }
  if (p === "this_week") {
    const day = now.getDay(); // 0 = Sun
    const diff = (day + 6) % 7; // Monday start
    const start = new Date(now); start.setDate(now.getDate() - diff);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: fmt(start), to: fmt(end) };
  }
  return { from: customFrom || undefined, to: customTo || undefined };
}

export function DownloadClientTimesheetDialog({
  client,
  onClose,
}: {
  client: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<Preset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const { from, to } = rangeForPreset(preset, customFrom, customTo);
      const res = await exportClientTimesheet({ clientId: client.id, clientName: client.name, from, to });
      if (res.entryCount === 0) {
        toast.warning("No entries found for this client in the selected range");
      } else {
        toast.success(`Downloaded ${res.entryCount} entries (${res.totalHours.toFixed(2)}h)`);
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!client} onOpenChange={(o) => { if (!o && !loading) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download timesheet — {client?.name}</DialogTitle>
          <DialogDescription>Export an Excel workbook with one sheet per freelancer plus a summary tab.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={preset} onValueChange={(v) => setPreset(v as Preset)} className="grid grid-cols-2 gap-2">
            {[
              { v: "this_month", l: "This month" },
              { v: "last_month", l: "Last month" },
              { v: "this_week", l: "This week" },
              { v: "all_time", l: "All time" },
              { v: "custom", l: "Custom range" },
            ].map(o => (
              <label key={o.v} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value={o.v} id={`preset-${o.v}`} />
                <span className="text-sm">{o.l}</span>
              </label>
            ))}
          </RadioGroup>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">From</Label><Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleDownload} disabled={loading || (preset === "custom" && !customFrom && !customTo)}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {loading ? "Generating…" : "Download Excel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}