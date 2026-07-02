import { useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";

export function useContaStats({ periodId }: { periodId?: string | null } = {}) {
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

      let quarterStart = new Date(monthStart);
      let quarterEnd = new Date(monthEnd);
      let quarterLabel = `Q${Math.ceil((monthStart.getMonth() + 1) / 3)}`;

      if (periodId) {
        const { data: period } = await supabase
          .from("tax_periods")
          .select("year,quarter")
          .eq("id", periodId)
          .single();

        if (period) {
          const startMonth = (period.quarter - 1) * 3;
          quarterStart = new Date(period.year, startMonth, 1);
          quarterStart.setHours(0, 0, 0, 0);
          quarterEnd = new Date(period.year, startMonth + 3, 1);
          quarterLabel = `Q${period.quarter}`;
        }
      }

      const [monthlyResultData, quarterData] = await Promise.all([
        supabase
          .from("expenses")
          .select("entry_type, base_amount, vat_amount, invoice_date")
          .eq("workspace_id", ws.id)
          .gte("invoice_date", monthStart.toISOString())
          .lt("invoice_date", monthEnd.toISOString()),
        supabase
          .from("expenses")
          .select("entry_type, base_amount, vat_amount, invoice_date")
          .eq("workspace_id", ws.id)
          .gte("invoice_date", quarterStart.toISOString())
          .lt("invoice_date", quarterEnd.toISOString()),
      ]);

      const monthlyData = monthlyResultData.data ?? [];
      const quarterRows = quarterData.data ?? [];

      const monthlyIncome =
        monthlyData.filter((row) => row.entry_type === "ingreso").reduce((sum, row) => sum + Number(row.base_amount ?? 0), 0);
      const monthlyExpenses =
        monthlyData.filter((row) => row.entry_type === "gasto").reduce((sum, row) => sum + Number(row.base_amount ?? 0), 0);
      const vatPaid =
        quarterRows.filter((row) => row.entry_type === "gasto").reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);
      const vatCollected =
        quarterRows.filter((row) => row.entry_type === "ingreso").reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);

      setStats({
        monthlyIncome,
        monthlyExpenses,
        monthlyResult: monthlyIncome - monthlyExpenses,
        quarterVatResult: vatCollected - vatPaid,
        currentQuarter: quarterLabel,
      });
      setLoading(false);
    }

    load();
  }, [ws, periodId]);

  return { stats, loading };
}
