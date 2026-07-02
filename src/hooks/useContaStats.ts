import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ContaStats {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyResult: number;
  quarterVatResult: number;
  currentQuarter: string;
}

export function useContaStats() {
  const [stats, setStats] = useState<ContaStats>({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyResult: 0,
    quarterVatResult: 0,
    currentQuarter: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const quarter = Math.ceil(month / 3);
      const quarterStart = new Date(year, (quarter - 1) * 3, 1).toISOString().split("T")[0];
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

      // Gastos del mes
      const { data: expenses } = await supabase
        .from("expenses")
        .select("base_amount, vat_amount")
        .gte("invoice_date", monthStart);

      // Facturas emitidas del mes (desde FactuNexa)
      const { data: invoices } = await supabase
        .from("invoices")
        .select("base_amount, vat_amount")
        .gte("invoice_date", monthStart);

      // IVA del trimestre
      const { data: quarterExpenses } = await supabase
        .from("expenses")
        .select("vat_amount")
        .gte("invoice_date", quarterStart);

      const { data: quarterInvoices } = await supabase
        .from("invoices")
        .select("vat_amount")
        .gte("invoice_date", quarterStart);

      const monthlyExpenses = expenses?.reduce((s, e) => s + Number(e.base_amount), 0) ?? 0;
      const monthlyIncome = invoices?.reduce((s, i) => s + Number(i.base_amount), 0) ?? 0;
      const vatPaid = quarterExpenses?.reduce((s, e) => s + Number(e.vat_amount), 0) ?? 0;
      const vatCollected = quarterInvoices?.reduce((s, i) => s + Number(i.vat_amount), 0) ?? 0;

      setStats({
        monthlyExpenses,
        monthlyIncome,
        monthlyResult: monthlyIncome - monthlyExpenses,
        quarterVatResult: vatCollected - vatPaid,
        currentQuarter: `Q${quarter} ${year}`,
      });
      setLoading(false);
    }

    fetchStats();
  }, []);

  return { stats, loading };
}