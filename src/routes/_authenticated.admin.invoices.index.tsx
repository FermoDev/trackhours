import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAdminInvoices, deleteAdminInvoice } from "@/lib/admin-invoices.functions";
import { generateInvoicePdf } from "@/lib/invoices.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/invoices/")({
  component: AdminInvoicesPage,
});

function AdminInvoicesPage() {
  const listFn = useServerFn(listAdminInvoices);
  const delFn = useServerFn(deleteAdminInvoice);
  const pdfFn = useServerFn(generateInvoicePdf);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listFn({ data: {} });
      setRows(data as any[]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const download = async (id: string) => {
    try {
      const { base64, filename } = await pdfFn({ data: { invoiceId: id } });
      const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this invoice? Entries will be un-billed and available for re-invoicing.")) return;
    try {
      await delFn({ data: { invoiceId: id } });
      toast.success("Invoice deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate freelancer invoices from billable hours</p>
        </div>
        <Button asChild className="rounded-xl">
          <Link to="/admin/invoices/new"><Plus className="h-4 w-4 mr-1.5" />New invoice</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No invoices yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Freelancer</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Issue date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.invoice_number}</TableCell>
                    <TableCell>{r.freelancer_name}</TableCell>
                    <TableCell>{r.client_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.period_start} → {r.period_end}
                    </TableCell>
                    <TableCell className="text-xs">{r.issue_date}</TableCell>
                    <TableCell className="text-right font-medium">
                      {r.currency} {(r.total_cents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => download(r.id)} title="Download PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}