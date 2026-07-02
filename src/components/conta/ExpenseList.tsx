import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Expense = {
  id: string;
  supplier_name: string;
  invoice_number: string | null;
  invoice_date: string;
  base_amount: number;
  vat_amount: number;
  total_amount: number;
  paid: boolean;
  category_id: string | null;
  expense_categories?: { name: string };
};

export default function ExpenseList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    supabase
      .from("expenses")
      .select("*, expense_categories(name)")
      .order("invoice_date", { ascending: false })
      .then(({ data }) => setExpenses((data as Expense[]) ?? []));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos registrados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay gastos todavía.</p>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{expense.supplier_name}</p>
                <p className="text-sm text-muted-foreground">
                  {expense.invoice_number || "Sin nº"} · {expense.invoice_date}
                </p>
                <p className="text-xs text-muted-foreground">
                  {expense.expense_categories?.name || "Sin categoría"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{Number(expense.total_amount).toFixed(2)} €</p>
                <Badge variant={expense.paid ? "default" : "secondary"}>
                  {expense.paid ? "Pagado" : "Pendiente"}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}