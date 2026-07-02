import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TaxPeriodPanel() {
  const [periods, setPeriods] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("tax_periods").select("*").order("year", { ascending: false }).order("quarter", { ascending: false });
      setPeriods(data ?? []);
    }
    load();
  }, []);

  async function createCurrentQuarter() {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const year = now.getFullYear();
    await supabase.from("tax_periods").upsert({ year, quarter, status: "abierto" }, { onConflict: "year,quarter" });
    const { data } = await supabase.from("tax_periods").select("*").order("year", { ascending: false }).order("quarter", { ascending: false });
    setPeriods(data ?? []);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Periodos fiscales</CardTitle>
        <Button onClick={createCurrentQuarter} variant="outline">Crear periodo actual</Button>
      </CardHeader>
      <CardContent>
        {periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay periodos todavía.</p>
        ) : (
          <ul className="space-y-2">
            {periods.map((period) => (
              <li key={`${period.year}-${period.quarter}`} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{period.year} · Q{period.quarter}</span>
                  <span className="text-muted-foreground">{period.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
