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
      const [clients, invoices, pending, remittances] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("id", { count: "exact", head: true }),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("remittances").select("id", { count: "exact", head: true }),
      ]);
      return {
        clients: clients.count ?? 0,
        invoices: invoices.count ?? 0,
        pending: pending.count ?? 0,
        remittances: remittances.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Clientes", value: stats?.clients ?? 0, icon: Users, to: "/clients" },
    { label: "Facturas", value: stats?.invoices ?? 0, icon: FileText, to: "/digifactu" },
    {
      label: "Pendientes de remesar",
      value: stats?.pending ?? 0,
      icon: AlertCircle,
      to: "/digifactu",
    },
    { label: "Remesas generadas", value: stats?.remittances ?? 0, icon: Send, to: "/digifactu" },
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
              <Link to="/digifactu">Importar facturas</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/digifactu">Generar remesa SEPA</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
