import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpenseEditDialog, ExpenseFormValues } from "@/components/conta/ExpenseEditDialog";
import { toast } from "sonner";

type ExpenseRecord = {
  id: string;
  workspace_id: string;
  entry_type: "gasto" | "ingreso";
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  base_amount: number;
  vat_rate: number;
  payment_method: string | null;
  paid: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

export default function ExpenseList() {
  const { data: ws } = useCurrentWorkspace();
  const qc = useQueryClient();
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["conta-expenses", ws?.id],
    enabled: !!ws,
    queryFn: async (): Promise<ExpenseRecord[]> => {
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function handleDelete(expenseId: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Movimiento eliminado");
    qc.invalidateQueries({ queryKey: ["conta-expenses", ws?.id] });
  }

  async function handleSave(values: ExpenseFormValues) {
    if (!editingExpense) return;
    const { error } = await supabase
      .from("expenses")
      .update({
        supplier_name: values.supplier_name,
        invoice_number: values.invoice_number,
        invoice_date: values.invoice_date,
        due_date: values.due_date,
        base_amount: Number(values.base_amount),
        vat_rate: Number(values.vat_rate),
        payment_method: values.payment_method,
        paid: values.paid,
        paid_at: values.paid ? new Date(values.due_date).toISOString().slice(0, 10) : null,
        entry_type: values.entry_type,
        notes: values.notes,
      })
      .eq("id", editingExpense.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Movimiento actualizado");
    setEditingExpense(null);
    qc.invalidateQueries({ queryKey: ["conta-expenses", ws?.id] });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Movimientos</CardTitle>
          <p className="text-sm text-muted-foreground">Gastos e ingresos sincronizados con ContaNexa.</p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando movimientos...</p>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay movimientos todavía.</p>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <div key={expense.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{expense.supplier_name || "Sin nombre"}</span>
                      <Badge variant={expense.entry_type === "ingreso" ? "secondary" : "outline"}>
                        {expense.entry_type === "ingreso" ? "Ingreso" : "Gasto"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {expense.invoice_number ? `${expense.invoice_number} · ` : ""}
                      {expense.invoice_date ? new Date(expense.invoice_date).toLocaleDateString("es-ES") : "Sin fecha"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-right text-lg font-bold">
                      {expense.base_amount.toFixed(2)} €
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setEditingExpense(expense)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(expense.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
                {expense.notes ? <p className="mt-2 text-sm text-muted-foreground">{expense.notes}</p> : null}
              </div>
            ))}
          </div>
        )}
        {editingExpense ? (
          <ExpenseEditDialog
            expense={editingExpense}
            onSave={handleSave}
            onDelete={() => handleDelete(editingExpense.id)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
