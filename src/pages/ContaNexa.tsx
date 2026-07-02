import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Receipt, Calculator } from "lucide-react";
import { useContaStats } from "@/hooks/useContaStats";
import ExpenseList from "@/components/conta/ExpenseList";
import ExpenseForm from "@/components/conta/ExpenseForm";
import TaxPeriodPanel from "@/components/conta/TaxPeriodPanel";
import PLReport from "@/components/conta/PLReport";

export default function ContaNexa() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { stats, loading } = useContaStats();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ContaNexa</h1>
        <p className="text-gray-500 text-sm">Contabilidad básica · Nexa Soluciones</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-500 font-medium uppercase">Ingresos este mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="text-green-500 w-4 h-4" />
              <span className="text-xl font-bold text-green-600">
                {loading ? "..." : `${stats.monthlyIncome.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-500 font-medium uppercase">Gastos este mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="text-red-500 w-4 h-4" />
              <span className="text-xl font-bold text-red-600">
                {loading ? "..." : `${stats.monthlyExpenses.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-500 font-medium uppercase">Resultado mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Receipt className="text-blue-500 w-4 h-4" />
              <span className={`text-xl font-bold ${stats.monthlyResult >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {loading ? "..." : `${stats.monthlyResult.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-500 font-medium uppercase">IVA trimestre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calculator className="text-purple-500 w-4 h-4" />
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Resumen</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="iva">IVA Trimestral</TabsTrigger>
          <TabsTrigger value="pyl">P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <PLReport condensed />
        </TabsContent>

        <TabsContent value="gastos">
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
      </Tabs>
    </div>
  );
}