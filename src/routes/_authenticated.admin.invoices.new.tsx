import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { previewAdminInvoice, createAdminInvoice, summarizeInvoiceWork } from "@/lib/admin-invoices.functions";
import { generateInvoicePdf } from "@/lib/invoices.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/invoices/new")({
  component: NewAdminInvoicePage,
});

function NewAdminInvoicePage() {
  const navigate = useNavigate();
  const previewFn = useServerFn(previewAdminInvoice);
  const createFn = useServerFn(createAdminInvoice);
  const pdfFn = useServerFn(generateInvoicePdf);
  const summarizeFn = useServerFn(summarizeInvoiceWork);

  const [users, setUsers] = useState<{ user_id: string; full_name: string; email: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rate, setRate] = useState("50");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [preview, setPreview] = useState<{ projects: { name: string; hours: number }[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name, email").eq("status", "active").order("full_name")
      .then(({ data }) => data && setUsers(data as any));
    supabase.from("clients").select("id, name").eq("status", "active").order("name")
      .then(({ data }) => data && setClients(data as any));
  }, []);

  const rateNum = Number(rate) || 0;
  const totals = useMemo(() => {
    if (!preview) return { hours: 0, amount: 0 };
    const h = preview.projects.reduce((s, p) => s + p.hours, 0);
    return { hours: h, amount: h * rateNum };
  }, [preview, rateNum]);

  const canPreview = userId && clientId && from && to;
  const canCreate = canPreview && rateNum > 0 && issueDate && description.trim().length > 0 && preview && preview.projects.length > 0;

  const doSummarize = async () => {
    if (!canPreview) return;
    setSummarizing(true);
    try {
      const res = await summarizeFn({ data: { userId, clientId, from, to } });
      setDescription(res.description);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate description");
    } finally {
      setSummarizing(false);
    }
  };

  const doPreview = async () => {
    if (!canPreview) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await previewFn({ data: { userId, clientId, from, to } });
      setPreview(res as any);
      if (!res.projects.length) {
        toast.message("No billable un-invoiced entries in this range.");
      } else {
        // Auto-generate description
        doSummarize();
      }
    } catch (e: any) {
      toast.error(e?.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const doCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const { invoiceId } = await createFn({
        data: {
          userId, clientId, from, to,
          rate: rateNum, currency,
          issueDate,
          dueDate: dueDate || null,
          notes: notes || null,
          description: description.trim(),
        },
      });
      toast.success("Invoice created");
      // Auto-download PDF
      try {
        const { base64, filename } = await pdfFn({ data: { invoiceId } });
        const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } catch { /* ignore */ }
      navigate({ to: "/admin/invoices" });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New invoice</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate an invoice for a freelancer from billable, un-invoiced hours</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Who and when</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Freelancer</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>From date</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To date</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={doPreview} disabled={!canPreview || previewing} variant="outline" className="rounded-xl">
          {previewing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Preview hours
        </Button>
      </div>

      {preview && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preview</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">For your reference — hours and rate are not shown on the invoice.</p>
          </CardHeader>
          <CardContent>
            {preview.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No billable un-invoiced entries in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.projects.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right">{p.hours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{currency} {(p.hours * rateNum).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold">{totals.hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{currency} {totals.amount.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {preview && preview.projects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Invoice description</CardTitle>
              <Button variant="outline" size="sm" onClick={doSummarize} disabled={summarizing} className="rounded-xl">
                {summarizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Single line shown on the PDF. Edit as needed.</p>
          </CardHeader>
          <CardContent>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={summarizing ? "Generating..." : "Description of work"} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Invoice details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Hourly rate</Label>
            <Input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Issue date</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Due date (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/admin/invoices" })} className="rounded-xl">Cancel</Button>
        <Button onClick={doCreate} disabled={!canCreate || creating} className="rounded-xl">
          {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create invoice & download PDF
        </Button>
      </div>
    </div>
  );
}