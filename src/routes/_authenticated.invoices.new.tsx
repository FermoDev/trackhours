import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  component: NewInvoicePage,
});

type DraftLine = {
  projectId: string;
  projectName: string;
  description: string;
  hours: number;
  rate: number; // dollars
  entryIds: string[];
};

function NewInvoicePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [defaultRate, setDefaultRate] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${format(new Date(), "yyyyMMdd")}`);
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("*").eq("status", "active").order("name")
      .then(({ data }) => data && setClients(data));
  }, []);

  const loadPreview = async () => {
    if (!user || !clientId) return;
    setLoadingPreview(true);
    const { data: entries } = await supabase
      .from("time_entries")
      .select("*, projects(id, name)")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .eq("billable", true)
      .is("invoice_id", null)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .not("duration_minutes", "is", null);

    const grouped = new Map<string, DraftLine>();
    for (const e of (entries as any[]) || []) {
      const pid = e.project_id;
      const name = e.projects?.name || "Untitled";
      const cur: DraftLine = grouped.get(pid) ?? {
        projectId: pid, projectName: name,
        description: `${name} (${from} → ${to})`,
        hours: 0, rate: parseFloat(defaultRate) || 0, entryIds: [] as string[],
      };
      cur.hours += (e.duration_minutes || 0) / 60;
      cur.entryIds.push(e.id);
      grouped.set(pid, cur);
    }
    const drafts = Array.from(grouped.values()).map(l => ({ ...l, hours: Math.round(l.hours * 100) / 100 }));
    setLines(drafts);
    setLoadingPreview(false);
    if (drafts.length === 0) toast.info("No un-invoiced billable hours in that range.");
  };

  const updateLine = (i: number, patch: Partial<DraftLine>) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((s, l) => s + l.hours * l.rate, 0);

  const save = async () => {
    if (!user || !clientId || lines.length === 0) return;
    setSaving(true);
    const totalCents = Math.round(subtotal * 100);
    const { data: inv, error } = await supabase.from("invoices").insert({
      user_id: user.id,
      client_id: clientId,
      invoice_number: invoiceNumber,
      issue_date: issueDate,
      due_date: dueDate || null,
      period_start: from,
      period_end: to,
      currency,
      subtotal_cents: totalCents,
      total_cents: totalCents,
      notes: notes || null,
      status: "draft" as const,
    }).select("id").single();

    if (error || !inv) {
      toast.error(error?.message || "Failed to create invoice");
      setSaving(false);
      return;
    }

    const items = lines.map((l, idx) => ({
      invoice_id: inv.id,
      project_id: l.projectId,
      description: l.description,
      hours: l.hours,
      rate_cents: Math.round(l.rate * 100),
      amount_cents: Math.round(l.hours * l.rate * 100),
      sort_order: idx,
    }));
    await supabase.from("invoice_line_items").insert(items);

    const allEntryIds = lines.flatMap(l => l.entryIds);
    if (allEntryIds.length > 0) {
      await supabase.from("time_entries").update({ invoice_id: inv.id }).in("id", allEntryIds);
    }

    toast.success("Invoice created");
    navigate({ to: "/invoices/$id", params: { id: inv.id } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/invoices" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New invoice</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Pick a client" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Period from</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Period to</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Default rate (per hour)</Label>
            <Input type="number" step="0.01" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="space-y-1.5 flex flex-col justify-end">
            <Button onClick={loadPreview} disabled={!clientId || loadingPreview}>
              {loadingPreview && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Load billable hours
            </Button>
          </div>
        </CardContent>
      </Card>

      {lines.length > 0 && (
        <>
        <Card>
          <CardHeader><CardTitle className="text-base">Line items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Hours</TableHead>
                  <TableHead className="w-28">Rate</TableHead>
                  <TableHead className="w-28 text-right">Amount</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={l.projectId}>
                    <TableCell>
                      <Input value={l.description} onChange={e => updateLine(i, { description: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={l.hours}
                        onChange={e => updateLine(i, { hours: parseFloat(e.target.value) || 0 })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={l.rate}
                        onChange={e => updateLine(i, { rate: parseFloat(e.target.value) || 0 })} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {currency} {(l.hours * l.rate).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeLine(i)}>×</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end items-center gap-4 px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold font-mono">{currency} {subtotal.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Invoice info</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Invoice number</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Issue date</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment instructions, thank-you note, etc." />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create invoice
          </Button>
        </div>
        </>
      )}
    </div>
  );
}