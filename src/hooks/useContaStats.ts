import { useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

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

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentQuarter = Math.ceil((monthStart.getMonth() + 1) / 3);
      const currentQuarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
      const currentQuarterEnd = new Date(now.getFullYear(), currentQuarter * 3, 1);

      let rangeStart = monthStart;
      let rangeEnd = monthEnd;
      let quarterStart = currentQuarterStart;
      let quarterEnd = currentQuarterEnd;
      let quarterLabel = `Q${currentQuarter}`;

      if (periodId) {
        const { data: period } = await supabase
          .from("tax_periods")
          .select("year,quarter")
          .eq("id", periodId)
          .single();

        if (period) {
          const startMonth = (period.quarter - 1) * 3;
          rangeStart = new Date(period.year, startMonth, 1);
          rangeEnd = new Date(period.year, startMonth + 3, 1);
          quarterStart = new Date(period.year, startMonth, 1);
          quarterEnd = new Date(period.year, startMonth + 3, 1);
          quarterLabel = `Q${period.quarter}`;
        }
      }

      const { data: periodRows } = await supabase
        .from("expenses")
        .select("entry_type, base_amount, vat_amount")
        .eq("workspace_id", ws.id)
        .gte("invoice_date", formatDate(rangeStart))
        .lt("invoice_date", formatDate(rangeEnd));

      const { data: quarterRows } = await supabase
        .from("expenses")
        .select("entry_type, vat_amount")
        .eq("workspace_id", ws.id)
        .gte("invoice_date", formatDate(quarterStart))
        .lt("invoice_date", formatDate(quarterEnd));

      const periodData = periodRows ?? [];
      const quarterData = quarterRows ?? [];

      const monthlyIncome = periodData.filter((row) => row.entry_type === "ingreso").reduce((sum, row) => sum + Number(row.base_amount ?? 0), 0);
      const monthlyExpenses = periodData.filter((row) => row.entry_type === "gasto").reduce((sum, row) => sum + Number(row.base_amount ?? 0), 0);
      const vatPaid = quarterData.filter((row) => row.entry_type === "gasto").reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);
      const vatCollected = quarterData.filter((row) => row.entry_type === "ingreso").reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);

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
