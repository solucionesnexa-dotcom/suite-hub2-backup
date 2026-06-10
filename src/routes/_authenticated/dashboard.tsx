import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Panel · Nexa Suite" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const [clients, pending, totalAmount, monthlyRemittances] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("invoices").select("amount").eq("status", "pending"),
        supabase
          .from("remittances")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart),
      ]);

      const totalPending = totalAmount.data?.reduce((sum, inv) => sum + Number(inv.amount), 0) ?? 0;

      return {
        activeClients: clients.count ?? 0,
        pendingInvoices: pending.count ?? 0,
        totalPendingAmount: totalPending,
        monthlyRemittances: monthlyRemittances.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Clientes activos", value: stats?.activeClients ?? 0, icon: Users, to: "/clients" },
    {
      label: "Facturas pendientes",
      value: stats?.pendingInvoices ?? 0,
      icon: AlertCircle,
      to: "/factu-nexa",
    },
    {
      label: "Importe pendiente",
      value: `€${(stats?.totalPendingAmount ?? 0).toFixed(2)}`,
      icon: FileText,
      to: "/factu-nexa",
    },
    {
      label: "Remesas este mes",
      value: stats?.monthlyRemittances ?? 0,
      icon: Send,
      to: "/factu-nexa",
    },
  ];

  return (
    <AppShell title="Panel">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bienvenido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen de tu agencia. Gestiona clientes y módulos desde la barra lateral.
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/clients">Nuevo cliente</Link>
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
