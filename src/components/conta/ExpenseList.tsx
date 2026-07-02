import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExpenseList() {
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
      setExpenses(data ?? []);
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay gastos todavía.</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((expense) => (
              <li key={expense.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{expense.supplier_name}</span>
                  <span className="font-semibold">{Number(expense.base_amount ?? 0).toFixed(2)} €</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {expense.invoice_number ? `${expense.invoice_number} · ` : ""}
                  {expense.invoice_date ? new Date(expense.invoice_date).toLocaleDateString("es-ES") : "Sin fecha"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
