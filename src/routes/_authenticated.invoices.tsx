import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Receipt } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/invoices")({
  component: InvoicesPage,
});

type InvoiceRow = Tables<"invoices"> & { clients: { name: string } | null };

function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*, clients(name)")
      .eq("user_id", user.id)
      .order("issue_date", { ascending: false });
    setInvoices((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusVariant = (s: string): "default" | "secondary" | "outline" => {
    if (s === "paid") return "default";
    if (s === "sent") return "secondary";
    return "outline";
  };

  const fmt = (cents: number, cur: string) => `${cur} ${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <Button asChild>
          <Link to="/invoices/new"><Plus className="h-4 w-4 mr-2" />New invoice</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No invoices yet. Create one from billable time entries.
                </TableCell></TableRow>
              ) : invoices.map(inv => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.clients?.name || "—"}</TableCell>
                  <TableCell>{format(new Date(inv.issue_date), "MMM d, yyyy")}</TableCell>
                  <TableCell><Badge variant={statusVariant(inv.status)}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{fmt(inv.total_cents, inv.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}