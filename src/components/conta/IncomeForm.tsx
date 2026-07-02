import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  "transferencia",
  "tarjeta",
  "efectivo",
  "domiciliacion",
] as const;

export default function IncomeForm() {
  const { data: ws } = useCurrentWorkspace();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transferencia");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ws) return toast.error("No se ha detectado workspace");
    setLoading(true);
    const { error } = await supabase.from("expenses").insert({
      workspace_id: ws.id,
      entry_type: "ingreso",
      supplier_name: supplierName,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
      base_amount: Number(amount),
      vat_rate: 0,
      payment_method,
      paid: true,
      paid_at: new Date().toISOString().slice(0, 10),
      notes,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Ingreso creado");
    setSupplierName("");
    setInvoiceNumber("");
    setAmount("");
    setPaymentMethod("transferencia");
    setNotes("");
    qc.invalidateQueries({ queryKey: ["conta-expenses", ws.id] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo ingreso</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cliente / Proveedor</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Nº factura</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Importe</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar ingreso"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
