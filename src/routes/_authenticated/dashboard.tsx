import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, Send, AlertCircle, TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Panel · Nexa Suite" }] }),
  component: DashboardPage,
});

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

function DashboardPage() {
  const { data: workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clients, invoices, pending, remittances] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "pending"),
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

  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data: conta } = useQuery({
    queryKey: ["dashboard-conta", workspaceId, year],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("entry_type,base_amount,vat_amount,invoice_date,is_deductible")
        .eq("workspace_id", workspaceId!)
        .gte("invoice_date", yearStart)
        .lte("invoice_date", yearEnd);
      if (error) throw error;

      const rows = data ?? [];
      const totals = { income: 0, expenses: 0, vatCollected: 0, vatPaid: 0 };
      const byMonth = Array.from({ length: 12 }, (_, i) => ({
        name: new Date(year, i, 1).toLocaleDateString("es-ES", { month: "short" }),
        ingresos: 0,
        gastos: 0,
      }));
      for (const r of rows) {
        const base = Number(r.base_amount);
        const vat = Number(r.vat_amount);
        const m = new Date(r.invoice_date).getMonth();
        if (r.entry_type === "ingreso") {
          totals.income += base;
          totals.vatCollected += vat;
          byMonth[m].ingresos += base;
        } else {
          totals.expenses += base;
          if (r.is_deductible) totals.vatPaid += vat;
          byMonth[m].gastos += base;
        }
      }
      return {
        ...totals,
        profit: totals.income - totals.expenses,
        vatResult: totals.vatCollected - totals.vatPaid,
        byMonth,
      };
    },
  });

  const cards = [
    { label: "Clientes", value: stats?.clients ?? 0, icon: Users, to: "/clients" },
    { label: "Facturas", value: stats?.invoices ?? 0, icon: FileText, to: "/factunexa" },
    { label: "Pendientes de remesar", value: stats?.pending ?? 0, icon: AlertCircle, to: "/factunexa" },
    { label: "Remesas generadas", value: stats?.remittances ?? 0, icon: Send, to: "/factunexa" },
  ];

  const bi = [
    { label: `Ingresos ${year}`, value: conta?.income ?? 0, icon: TrendingUp, tone: "text-emerald-600" },
    { label: `Gastos ${year}`, value: conta?.expenses ?? 0, icon: TrendingDown, tone: "text-rose-600" },
    { label: `Beneficio ${year}`, value: conta?.profit ?? 0, icon: Wallet, tone: (conta?.profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600" },
    { label: `IVA a liquidar ${year}`, value: conta?.vatResult ?? 0, icon: Receipt, tone: "text-amber-600" },
  ];

  return (
    <AppShell title="Panel">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bienvenido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vista global de tu agencia — actividad y contabilidad {year}.
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

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Contabilidad {year}</h3>
              <p className="text-xs text-muted-foreground">Basado en movimientos de ContaNexa</p>
            </div>
            <Button asChild variant="outline" size="sm"><Link to="/contanexa">Abrir ContaNexa</Link></Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bi.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</CardTitle>
                  <c.icon className={`h-4 w-4 ${c.tone}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-semibold tabular-nums ${c.tone}`}>{eur(c.value)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución mensual {year}</CardTitle>
            <CardDescription>Ingresos vs gastos (base imponible)</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conta?.byMonth ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: number) => eur(v)} />
                <Legend />
                <Bar dataKey="ingresos" fill="#10b981" />
                <Bar dataKey="gastos" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/clients">Nuevo cliente</Link></Button>
            <Button asChild><Link to="/factunexa">Importar facturas</Link></Button>
            <Button asChild variant="secondary"><Link to="/factunexa">Generar remesa SEPA</Link></Button>
            <Button asChild variant="outline"><Link to="/contanexa">Añadir movimiento contable</Link></Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
