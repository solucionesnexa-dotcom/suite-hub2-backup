import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useContaStats() {
  const [stats, setStats] = useState({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyResult: 0,
    quarterVatResult: 0,
    currentQuarter: "Q1",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: expenses } = await supabase.from("expenses").select("base_amount, vat_amount");
      const monthlyExpenses = expenses?.reduce((sum, expense) => sum + Number(expense.base_amount ?? 0), 0) ?? 0;
      const vatPaid = expenses?.reduce((sum, expense) => sum + Number(expense.vat_amount ?? 0), 0) ?? 0;
      setStats({
        monthlyIncome: 0,
        monthlyExpenses,
        monthlyResult: -monthlyExpenses,
        quarterVatResult: -vatPaid,
        currentQuarter: "Q1",
      });
      setLoading(false);
    }
    load();
  }, []);

  return { stats, loading };
}
