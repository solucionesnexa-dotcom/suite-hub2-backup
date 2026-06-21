import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BadgeEuro, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kit-digital")({
  ssr: false,
  head: () => ({ meta: [{ title: "Kit Digital · Nexa Suite" }] }),
  component: KitDigitalPage,
});

function KitDigitalPage() {
  const [employees, setEmployees] = useState(2);
  const [revenue, setRevenue] = useState("menos_500k");
  const [activeBonus, setActiveBonus] = useState(false);

  const result = useMemo(() => {
    if (employees >= 50 || revenue === "mas_3m") {
      return { segment: "Segmento D", amount: "No elegible de forma general", eligible: false };
    }
    if (employees >= 10) return { segment: "Segmento C", amount: "Hasta 12.000 EUR", eligible: true };
    if (employees >= 3) return { segment: "Segmento B", amount: "Hasta 6.000 EUR", eligible: true };
    return { segment: "Segmento A", amount: "Hasta 2.000 EUR", eligible: true };
  }, [employees, revenue]);

  return (
    <AppShell title="Kit Digital">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Checker Kit Digital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Numero de empleados</Label>
              <Input type="number" min={0} value={employees} onChange={(e) => setEmployees(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Facturacion anual aproximada</Label>
              <Select value={revenue} onValueChange={setRevenue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="menos_500k">Menos de 500k</SelectItem>
                  <SelectItem value="500k_1m">500k - 1M</SelectItem>
                  <SelectItem value="1m_3m">1M - 3M</SelectItem>
                  <SelectItem value="mas_3m">Mas de 3M</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sector</Label>
              <Input placeholder="Clinica, despacho, pyme industrial..." />
            </div>
            <div className="space-y-2">
              <Label>CNAE opcional</Label>
              <Input placeholder="Ej. 8622" />
            </div>
            <label className="flex items-center justify-between rounded-md border p-3 text-sm">
              Bono Kit Digital activo
              <Switch checked={activeBonus} onCheckedChange={setActiveBonus} />
            </label>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Segmento</div>
                <div className="mt-1 text-2xl font-semibold">{result.segment}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Cuantia</div>
                <div className="mt-1 text-2xl font-semibold text-primary">{result.amount}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Estado</div>
                <div className="mt-1 text-2xl font-semibold">{result.eligible && !activeBonus ? "Prioritario" : "Revisar"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Servicios Nexa elegibles</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {["Automatizacion de procesos", "CRM y gestion de clientes", "Factura electronica", "Business Intelligence", "Presencia avanzada en internet", "Comunicaciones seguras"].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                  <BadgeEuro className="h-4 w-4 text-secondary" /> {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pasos recomendados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>1. Confirmar plantilla media y CNAE. 2. Revisar si existe bono activo. 3. Preparar diagnostico y alcance. 4. Tramitar desde Acelera Pyme.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/diagnostico">Solicitar diagnostico gratuito</Link>
                </Button>
                <Button asChild variant="outline">
                  <a href="https://www.acelerapyme.gob.es/kit-digital" target="_blank" rel="noreferrer">
                    Acelera Pyme <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
