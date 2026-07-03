import * as React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ExpenseFormValues = {
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  base_amount: string;
  vat_rate: string;
  payment_method: string;
  paid: boolean;
  entry_type: "gasto" | "ingreso";
  notes: string;
  category_id?: string | null;
  category_other?: string | null;
};

const paymentMethods = [
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "efectivo", label: "Efectivo" },
  { value: "domiciliacion", label: "Domiciliación" },
];

type ExpenseRecord = {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  base_amount: number;
  vat_rate: number;
  payment_method: string | null;
  paid: boolean;
  entry_type: "gasto" | "ingreso";
  notes: string | null;
  invoice_id?: string | null;
};

export function ExpenseEditDialog({
  expense,
  onSave,
  onDelete,
}: {
  expense: ExpenseRecord;
  onSave: (values: ExpenseFormValues) => void;
  onDelete: () => void;
}) {
  const { register, handleSubmit, watch, setValue } = useForm<ExpenseFormValues>({
    defaultValues: {
      supplier_name: expense.supplier_name ?? "",
      invoice_number: expense.invoice_number ?? "",
      invoice_date: expense.invoice_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      due_date: expense.due_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      base_amount: String(expense.base_amount ?? ""),
      vat_rate: String(expense.vat_rate ?? 21),
      payment_method: expense.payment_method ?? "transferencia",
      paid: expense.paid ?? false,
      entry_type: expense.entry_type ?? "gasto",
      notes: expense.notes ?? "",
        category_id: (expense as any).category_id ?? null,
        category_other: (expense as any).category_other ?? null,
    },
  });

  const entryType = watch("entry_type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open === undefined ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">Editar</Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
          <DialogDescription>Modifica el movimiento de ContaNexa.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSave)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={entryType} onValueChange={(value) => setValue("entry_type", value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasto">Gasto</SelectItem>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría (ID)</Label>
              <Input {...register("category_id")} placeholder="ID categoría (opcional)" />
            </div>
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select value={watch("payment_method")} onValueChange={(value) => setValue("payment_method", value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Proveedor/Cliente</Label>
              <Input {...register("supplier_name")} />
            </div>
            <div className="space-y-2">
              <Label>Número factura</Label>
              <Input {...register("invoice_number")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" {...register("invoice_date")} />
            </div>
            <div className="space-y-2">
              <Label>Vencimiento</Label>
              <Input type="date" {...register("due_date")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Importe base</Label>
              <Input type="number" step="0.01" {...register("base_amount")} />
            </div>
            <div className="space-y-2">
              <Label>IVA</Label>
              <Input type="number" step="0.01" {...register("vat_rate")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea {...register("notes")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Button type="button" variant="destructive" onClick={onDelete}>
              Eliminar movimiento
            </Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
