import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { db, eur } from "@/lib/nexa";
import { AlertCircle, Download, FileText, Send, Users, WalletCards } from "lucide-react";
import { downloadXml } from "@/lib/sepa";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard · Nexa Suite" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: ws } = useCurrentWorkspace();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data } = useQuery({
    queryKey: ["dashboard", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const [clients, pendingInvoices, remittancesMonth, recentInvoices, recentRemittances, mandates] =
        await Promise.all([
          db
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", ws!.id)
            .in("status", ["cerrado", "retainer_activo"]),
          db
            .from("invoices")
            .select("id, amount, client_id, invoice_number, due_date, created_at, status")
            .eq("workspace_id", ws!.id)
            .eq("status", "pending"),
          db
            .from("remittances")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", ws!.id)
            .gte("created_at", monthStart.toISOString()),
          db
            .from("invoices")
            .select("id, invoice_number, amount, due_date, created_at, clients(name)")
            .eq("workspace_id", ws!.id)
            .order("created_at", { ascending: false })
            .limit(5),
          db
            .from("remittances")
            .select("id, message_id, status, total_amount, xml_content, created_at")
            .eq("workspace_id", ws!.id)
            .order("created_at", { ascending: false })
            .limit(3),
          db
            .from("sepa_mandates")
            .select("client_id")
            .eq("workspace_id", ws!.id)
            .eq("is_active", true),
        ]);
      for (const res of [clients, pendingInvoices, remittancesMonth, recentInvoices, recentRemittances, mandates]) {
        if (res.error) throw res.error;
      }
      const activeMandates = new Set((mandates.data ?? []).map((m: any) => m.client_id));
      const pending = pendingInvoices.data ?? [];
      const clientsWithoutMandate = new Set(
        pending.filter((i: any) => !activeMandates.has(i.client_id)).map((i: any) => i.client_id),
      );
      return {
        activeClients: clients.count ?? 0,
        pendingInvoices: pending.length,
        pendingAmount: pending.reduce((sum: number, i: any) => sum + Number(i.amount ?? 0), 0),
        remittancesMonth: remittancesMonth.count ?? 0,
        recentInvoices: recentInvoices.data ?? [],
        recentRemittances: recentRemittances.data ?? [],
        clientsWithoutMandate: clientsWithoutMandate.size,
        remittancesWithReturns: (recentRemittances.data ?? []).filter((r: any) => r.status === "con_devoluciones"),
      };
    },
  });

  const cards = [
    { label: "Clientes activos", value: data?.activeClients ?? 0, icon: Users, to: "/pipeline" },
    { label: "Facturas pendientes", value: data?.pendingInvoices ?? 0, icon: FileText, to: "/factunexa" },
    { label: "Pendiente de cobro", value: eur(data?.pendingAmount ?? 0), icon: WalletCards, to: "/factunexa" },
    { label: "Remesas este mes", value: data?.remittancesMonth ?? 0, icon: Send, to: "/factunexa" },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Pulso comercial y operativo del workspace.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label} to={card.to}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                    {card.label}
                  </CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">{card.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ultimas facturas importadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.recentInvoices ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No hay facturas recientes.</p>
              )}
              {(data?.recentInvoices ?? []).map((invoice: any) => (
                <div key={invoice.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">{invoice.invoice_number}</div>
                    <div className="text-sm text-muted-foreground">{invoice.clients?.name ?? "Cliente"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{eur(invoice.amount)}</div>
                    <div className="text-xs text-muted-foreground">{invoice.due_date}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ultimas remesas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.recentRemittances ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Todavia no hay remesas.</p>
              )}
              {(data?.recentRemittances ?? []).map((remittance: any) => (
                <div key={remittance.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">{remittance.message_id}</div>
                    <Badge variant="outline">{remittance.status}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadXml(`${remittance.message_id}.xml`, remittance.xml_content)}
                  >
                    <Download className="mr-2 h-4 w-4" /> XML
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AlertRow
              active={(data?.clientsWithoutMandate ?? 0) > 0}
              text={`${data?.clientsWithoutMandate ?? 0} clientes tienen facturas pendientes sin mandato SEPA activo.`}
              to="/factunexa"
            />
            <AlertRow
              active={(data?.remittancesWithReturns?.length ?? 0) > 0}
              text={`${data?.remittancesWithReturns?.length ?? 0} remesas con devoluciones requieren revision.`}
              to="/factunexa"
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function AlertRow({ active, text, to }: { active: boolean; text: string; to: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertCircle className={active ? "h-4 w-4 text-destructive" : "h-4 w-4 text-muted-foreground"} />
        <span className={active ? "font-medium" : "text-muted-foreground"}>{text}</span>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to={to}>Revisar</Link>
      </Button>
    </div>
  );
}
