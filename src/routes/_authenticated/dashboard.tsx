import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download, FileText, Send, Users } from "lucide-react";
import { downloadXml } from "@/lib/sepa";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Panel · Nexa Suite" }] }),
  component: DashboardPage,
});

type InvoiceRow = {
  id: string;
  invoice_number: string;
  client_id: string;
  amount: number;
  due_date: string;
  created_at: string;
  status: string;
  estado_cobro?: string | null;
  clients?: { name: string; sector: string | null } | null;
};

type RemittanceRow = {
  id: string;
  message_id: string;
  collection_date: string;
  status: string;
  total_amount: number;
  xml_content: string;
  created_at: string;
};

type MissingMandateAlert = {
  clientId: string;
  clientName: string;
  pendingCount: number;
  pendingAmount: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

function isPendingInvoice(invoice: Pick<InvoiceRow, "status" | "estado_cobro">) {
  return invoice.status === "pending" || invoice.estado_cobro === "pendiente";
}

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        clientsRes,
        pendingRes,
        recentInvoicesRes,
        recentRemittancesRes,
        monthlyRemittancesRes,
        mandatesRes,
        returnedRemittancesRes,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("estado", "activo"),
        supabase
          .from("invoices")
          .select("id, client_id, amount, status, estado_cobro, clients(name, sector)")
          .or("status.eq.pending,estado_cobro.eq.pendiente"),
        supabase
          .from("invoices")
          .select("id, invoice_number, client_id, amount, due_date, created_at, status, estado_cobro, clients(name, sector)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("remittances")
          .select("id, message_id, collection_date, status, total_amount, xml_content, created_at")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("remittances")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart),
        supabase.from("sepa_mandates").select("client_id").eq("is_active", true),
        supabase
          .from("remittances")
          .select("id, message_id, collection_date, status, total_amount, xml_content, created_at")
          .eq("status", "with_returns")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      for (const result of [
        clientsRes,
        pendingRes,
        recentInvoicesRes,
        recentRemittancesRes,
        monthlyRemittancesRes,
        mandatesRes,
        returnedRemittancesRes,
      ]) {
        if (result.error) throw result.error;
      }

      const pendingInvoices = ((pendingRes.data ?? []) as InvoiceRow[]).filter(isPendingInvoice);
      const activeMandateClientIds = new Set((mandatesRes.data ?? []).map((m) => m.client_id));
      const missingMandates = new Map<string, MissingMandateAlert>();

      for (const invoice of pendingInvoices) {
        if (activeMandateClientIds.has(invoice.client_id)) continue;
        const current = missingMandates.get(invoice.client_id) ?? {
          clientId: invoice.client_id,
          clientName: invoice.clients?.name ?? "Cliente sin nombre",
          pendingCount: 0,
          pendingAmount: 0,
        };
        current.pendingCount += 1;
        current.pendingAmount += Number(invoice.amount);
        missingMandates.set(invoice.client_id, current);
      }

      return {
        activeClients: clientsRes.count ?? 0,
        pendingInvoices: pendingInvoices.length,
        totalPendingAmount: pendingInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
        monthlyRemittances: monthlyRemittancesRes.count ?? 0,
        recentInvoices: (recentInvoicesRes.data ?? []) as InvoiceRow[],
        recentRemittances: (recentRemittancesRes.data ?? []) as RemittanceRow[],
        missingMandates: Array.from(missingMandates.values()).slice(0, 5),
        returnedRemittances: (returnedRemittancesRes.data ?? []) as RemittanceRow[],
      };
    },
  });

  const cards = [
    { label: "Clientes activos", value: data?.activeClients ?? 0, icon: Users, to: "/clients" },
    {
      label: "Facturas pendientes",
      value: data?.pendingInvoices ?? 0,
      icon: AlertCircle,
      to: "/factu-nexa",
    },
    {
      label: "Importe pendiente",
      value: money(data?.totalPendingAmount ?? 0),
      icon: FileText,
      to: "/factu-nexa",
    },
    {
      label: "Remesas este mes",
      value: data?.monthlyRemittances ?? 0,
      icon: Send,
      to: "/factu-nexa",
    },
  ];

  return (
    <AppShell title="Panel">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bienvenido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen operativo del workspace: ventas, cobros y alertas de seguimiento.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} to={c.to}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </CardTitle>
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas facturas importadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <EmptyLine text="Cargando facturas..." />}
              {!isLoading && data?.recentInvoices.length === 0 && (
                <EmptyLine text="Aún no hay facturas importadas." />
              )}
              {data?.recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{invoice.invoice_number}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {invoice.clients?.name ?? "Cliente sin nombre"} · vence {invoice.due_date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{money(Number(invoice.amount))}</div>
                    <Badge variant={isPendingInvoice(invoice) ? "outline" : "secondary"}>
                      {isPendingInvoice(invoice) ? "Pendiente" : invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas remesas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <EmptyLine text="Cargando remesas..." />}
              {!isLoading && data?.recentRemittances.length === 0 && (
                <EmptyLine text="Aún no hay remesas generadas." />
              )}
              {data?.recentRemittances.map((remittance) => (
                <div
                  key={remittance.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{remittance.message_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {remittance.collection_date} · {money(Number(remittance.total_amount))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{remittance.status}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => downloadXml(`${remittance.message_id}.xml`, remittance.xml_content)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AlertBlock
              title="Clientes sin mandato SEPA activo"
              empty="Sin alertas de mandatos."
              items={data?.missingMandates.map((item) => ({
                key: item.clientId,
                label: item.clientName,
                detail: `${item.pendingCount} facturas pendientes · ${money(item.pendingAmount)}`,
                to: "/clients/$id",
                params: { id: item.clientId },
              }))}
            />
            <AlertBlock
              title="Remesas con devoluciones"
              empty="Sin remesas con devoluciones."
              items={data?.returnedRemittances.map((item) => ({
                key: item.id,
                label: item.message_id,
                detail: `${item.collection_date} · ${money(Number(item.total_amount))}`,
                to: "/factu-nexa",
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/clients">Nuevo cliente</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pipeline">Abrir pipeline</Link>
            </Button>
            <Button asChild>
              <Link to="/factu-nexa">Importar facturas</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/factu-nexa">Generar remesa SEPA</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}

function AlertBlock({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items?: Array<{
    key: string;
    label: string;
    detail: string;
    to: "/clients/$id" | "/factu-nexa";
    params?: { id: string };
  }>;
}) {
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="text-sm font-medium">{title}</div>
      {items?.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              params={item.params}
              className="block rounded-md bg-muted/50 p-3 transition-colors hover:bg-muted"
            >
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.detail}</div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
