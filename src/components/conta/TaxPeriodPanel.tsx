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

  async function calculatePeriod(period: any) {
    if (!period || !period.year || !period.quarter) return;
    const year = period.year;
    const q = period.quarter;
    const startMonth = (q - 1) * 3 + 1;
    const start = new Date(year, startMonth - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, startMonth + 2, 1);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    const endStr = end.toISOString().slice(0, 10);

    const { data } = await supabase.from("expenses").select("vat_amount,entry_type").gte("invoice_date", start).lte("invoice_date", endStr).order("invoice_date", { ascending: true });
    const rows = data ?? [];
    const vatPaid = rows.filter((r: any) => r.entry_type === 'gasto').reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0);
    const vatCollected = rows.filter((r: any) => r.entry_type === 'ingreso').reduce((s: number, r: any) => s + Number(r.vat_amount || 0), 0);
    const vatResult = vatCollected - vatPaid;

    await supabase.from("tax_periods").update({ vat_collected: vatCollected, vat_paid: vatPaid, vat_result: vatResult }).eq("id", period.id);
    const { data: refreshed } = await supabase.from("tax_periods").select("*").order("year", { ascending: false }).order("quarter", { ascending: false });
    setPeriods(refreshed ?? []);
  }

  async function closePeriod(period: any) {
    await supabase.from("tax_periods").update({ status: 'presentado', closed_at: new Date().toISOString() }).eq("id", period.id);
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
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{period.status}</span>
                    <Button size="sm" variant="outline" onClick={() => calculatePeriod(period)}>Calcular IVA</Button>
                    <Button size="sm" variant="secondary" onClick={() => closePeriod(period)}>Cerrar periodo</Button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">IVA repercutido: {period.vat_collected ?? 0} € · IVA soportado: {period.vat_paid ?? 0} € · Resultado: {period.vat_result ?? 0} €</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
