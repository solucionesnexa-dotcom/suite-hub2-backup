import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PLReport({ condensed = false }: { condensed?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{condensed ? "Resumen P&L" : "Pérdidas y ganancias"}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          El módulo de reporting se cargará cuando la base de datos tenga los datos de gastos e ingresos.
        </p>
      </CardContent>
    </Card>
  );
}
