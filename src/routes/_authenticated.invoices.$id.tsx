import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateInvoicePdf } from "@/lib/invoices.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const downloadFn = useServerFn(generateInvoicePdf);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: inv } = await supabase
      .from("invoices")
      .select("*, clients(name)")
      .eq("id", id)
      .single();
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", id)
      .order("sort_order");
    setInvoice(inv);
    setItems(lineItems || []);
    setLoading(false);
  }, [user, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (cents: number) => `${invoice?.currency || "USD"} ${(cents / 100).toFixed(2)}`;

  const setStatus = async (status: "draft" | "sent" | "paid") => {
    await supabase.from("invoices").update({ status }).eq("id", id);
    toast.success(`Marked as ${status}`);
    fetchData();
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const { base64, filename } = await downloadFn({ data: { invoiceId: id } });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = filename;
      link.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const deleteInvoice = async () => {
    await supabase.from("time_entries").update({ invoice_id: null }).eq("invoice_id", id);
    await supabase.from("invoices").delete().eq("id", id);
    toast.success("Invoice deleted");
    navigate({ to: "/invoices" });
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  if (!invoice) return <div className="text-center py-12 text-muted-foreground">Invoice not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/invoices" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{invoice.invoice_number}</h1>
            <p className="text-sm text-muted-foreground">{invoice.clients?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={invoice.status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={downloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            PDF
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete invoice {invoice.invoice_number} and unlink its time entries (they remain available for future invoices).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteInvoice} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
          <KV label="Status"><Badge>{invoice.status}</Badge></KV>
          <KV label="Issued">{format(new Date(invoice.issue_date), "MMM d, yyyy")}</KV>
          <KV label="Due">{invoice.due_date ? format(new Date(invoice.due_date), "MMM d, yyyy") : "—"}</KV>
          <KV label="Period">{invoice.period_start && invoice.period_end ? `${invoice.period_start} → ${invoice.period_end}` : "—"}</KV>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Line items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-right font-mono">{Number(it.hours).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(it.rate_cents)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(it.amount_cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end items-center gap-4 px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold font-mono">{fmt(invoice.total_cents)}</span>
          </div>
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{invoice.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}