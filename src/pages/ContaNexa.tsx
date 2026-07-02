import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Receipt, Calculator } from "lucide-react";
import { useContaStats } from "@/hooks/useContaStats";
import ExpenseList from "@/components/conta/ExpenseList";
import ExpenseForm from "@/components/conta/ExpenseForm";
import IncomeForm from "@/components/conta/IncomeForm";
import TaxPeriodPanel from "@/components/conta/TaxPeriodPanel";
import PLReport from "@/components/conta/PLReport";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function ContaNexa() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { stats, loading } = useContaStats();
  const [periods, setPeriods] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase.from("tax_periods").select("*").order("year", { ascending: false }).order("quarter", { ascending: false });
      if (mounted) setPeriods(data ?? []);
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ContaNexa</h1>
        <p className="text-sm text-gray-500">Contabilidad básica · Nexa Soluciones</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Ingresos este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xl font-bold text-green-600">
                {loading ? "..." : `${stats.monthlyIncome.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Gastos este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xl font-bold text-red-600">
                {loading ? "..." : `${stats.monthlyExpenses.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Resultado mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-500" />
              <span className={`text-xl font-bold ${stats.monthlyResult >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {loading ? "..." : `${stats.monthlyResult.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500">
              IVA trimestre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-purple-500" />
              <div>
                <span className={`text-xl font-bold ${stats.quarterVatResult >= 0 ? "text-purple-600" : "text-green-600"}`}>
                  {loading ? "..." : `${stats.quarterVatResult.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
                </span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {stats.currentQuarter}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Resumen</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="iva">IVA Trimestral</TabsTrigger>
          <TabsTrigger value="pyl">P&L</TabsTrigger>
          {periods.map((p) => (
            <TabsTrigger key={p.id} value={`period-${p.id}`}>
              {p.year}·Q{p.quarter} {p.status !== 'abierto' ? '(cerrado)' : ''}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <PLReport condensed />
        </TabsContent>

        <TabsContent value="movimientos">
          <div className="space-y-4">
            <ExpenseForm />
            <ExpenseList />
          </div>
        </TabsContent>

        <TabsContent value="iva">
          <TaxPeriodPanel />
        </TabsContent>

        <TabsContent value="pyl">
          <PLReport />
        </TabsContent>
        {periods.map((p) => (
          <TabsContent key={p.id} value={`period-${p.id}`}>
            <PLReport periodId={p.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
