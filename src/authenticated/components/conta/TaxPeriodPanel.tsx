import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TaxPeriod = {
  id: string;
  year: number;
  quarter: number;
  status: string;
  vat_collected: number | null;
  vat_paid: number | null;
  vat_result: number | null;
};

export default function TaxPeriodPanel() {
  const [periods, setPeriods] = useState<TaxPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPeriods = async () => {
    const { data } = await supabase.from("tax_periods").select("*").order("year", { ascending: false }).order("quarter", { ascending: false });
    setPeriods((data as TaxPeriod[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  const createCurrentQuarter = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    await supabase.from("tax_periods").upsert({ year, quarter, status: "abierto" }, { onConflict: "year,quarter" });
    loadPeriods();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>IVA trimestral</CardTitle>
        <Button variant="outline" onClick={createCurrentQuarter}>Crear trimestre actual</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p>Cargando...</p>
        ) : periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay trimestres creados.</p>
        ) : (
          periods.map((period) => (
            <div key={period.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Q{period.quarter} · {period.year}</p>
                <p className="text-sm text-muted-foreground">Estado: {period.status}</p>
              </div>
              <div className="text-right text-sm">
                <p>Repercutido: {Number(period.vat_collected || 0).toFixed(2)} €</p>
                <p>Soportado: {Number(period.vat_paid || 0).toFixed(2)} €</p>
                <p className="font-semibold">Resultado: {Number(period.vat_result || 0).toFixed(2)} €</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}