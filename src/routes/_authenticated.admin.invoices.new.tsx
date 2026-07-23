import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { previewAdminInvoice, createAdminInvoice } from "@/lib/admin-invoices.functions";
import { generateInvoicePdf } from "@/lib/invoices.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/invoices/new")({
  component: NewAdminInvoicePage,
});

function NewAdminInvoicePage() {
  const navigate = useNavigate();
  const previewFn = useServerFn(previewAdminInvoice);
  const createFn = useServerFn(createAdminInvoice);
  const pdfFn = useServerFn(generateInvoicePdf);

  const [users, setUsers] = useState<{ user_id: string; full_name: string; email: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rate, setRate] = useState("50");
  const [currency, setCurrency] = useState("USD");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
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
  const canCreate = canPreview && rateNum > 0 && invoiceNumber && issueDate && preview && preview.projects.length > 0;

  const doPreview = async () => {
    if (!canPreview) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await previewFn({ data: { userId, clientId, from, to } });
      setPreview(res as any);
      if (!res.projects.length) toast.message("No billable un-invoiced entries in this range.");
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
          invoiceNumber, issueDate,
          dueDate: dueDate || null,
          notes: notes || null,
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
          <CardHeader className="pb-3"><CardTitle className="text-base">Preview</CardTitle></CardHeader>
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

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Invoice details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Invoice number</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-2026-001" />
          </div>
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