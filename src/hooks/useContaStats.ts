import { useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";

export function useContaStats() {
  const { data: ws } = useCurrentWorkspace();
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
      if (!ws) return;
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const { data } = await supabase
        .from("expenses")
        .select("entry_type, base_amount, vat_amount, invoice_date")
        .eq("workspace_id", ws.id)
        .gte("invoice_date", monthStart.toISOString())
        .lt("invoice_date", monthEnd.toISOString());

      const monthlyIncome =
        data?.filter((row) => row.entry_type === "ingreso").reduce((sum, row) => sum + Number(row.base_amount ?? 0), 0) ?? 0;
      const monthlyExpenses =
        data?.filter((row) => row.entry_type === "gasto").reduce((sum, row) => sum + Number(row.base_amount ?? 0), 0) ?? 0;
      const vatPaid =
        data?.filter((row) => row.entry_type === "gasto").reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0) ?? 0;
      const vatCollected =
        data?.filter((row) => row.entry_type === "ingreso").reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0) ?? 0;

      setStats({
        monthlyIncome,
        monthlyExpenses,
        monthlyResult: monthlyIncome - monthlyExpenses,
        quarterVatResult: vatCollected - vatPaid,
        currentQuarter: `Q${Math.ceil((monthStart.getMonth() + 1) / 3)}`,
      });
      setLoading(false);
    }
    load();
  }, [ws]);

  return { stats, loading };
}
