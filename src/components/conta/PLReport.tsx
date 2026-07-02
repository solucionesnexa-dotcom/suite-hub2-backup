import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function PLReport({ condensed = false, periodId }: { condensed?: boolean; periodId?: string }) {
  const [loading, setLoading] = useState(false);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [vatCollected, setVatCollected] = useState(0);
  const [vatPaid, setVatPaid] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        let where: any = {};
        if (periodId) {
          const { data: p } = await supabase.from("tax_periods").select("year,quarter").eq("id", periodId).single();
          if (p) {
            const startMonth = (p.quarter - 1) * 3 + 1;
            const start = new Date(p.year, startMonth - 1, 1).toISOString().slice(0, 10);
            const endDate = new Date(p.year, startMonth + 2, 1);
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
            const end = endDate.toISOString().slice(0, 10);
            where = { start, end };
          }
        }

        let query = supabase.from("expenses").select("entry_type, base_amount, vat_amount");
        if (where.start) query = query.gte("invoice_date", where.start).lte("invoice_date", where.end);
        const { data } = await query;
        const rows = data ?? [];
        const incomes = rows.filter((r: any) => r.entry_type === "ingreso");
        const expenses = rows.filter((r: any) => r.entry_type === "gasto");
        const incomeSum = incomes.reduce((s: number, r: any) => s + Number(r.base_amount || 0), 0);
        const expenseSum = expenses.reduce((s: number, r: any) => s + Number(r.base_amount || 0), 0);
        const vatC = incomes.reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0);
        const vatP = expenses.reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0);
        if (!mounted) return;
        setIncomeTotal(incomeSum);
        setExpenseTotal(expenseSum);
        setVatCollected(vatC);
        setVatPaid(vatP);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [periodId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{condensed ? "Resumen P&L" : periodId ? "P&L periodo" : "Pérdidas y ganancias"}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Ingresos</div>
              <div className="font-bold">{incomeTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Gastos</div>
              <div className="font-bold">{expenseTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">IVA repercutido</div>
              <div className="font-bold">{vatCollected.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">IVA soportado</div>
              <div className="font-bold">{vatPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Resultado</div>
              <div className="font-bold">{(incomeTotal - expenseTotal).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
