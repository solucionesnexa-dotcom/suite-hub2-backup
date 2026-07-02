import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ExpenseForm() {
  const [loading, setLoading] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [vatRate, setVatRate] = useState("21");
  const [categoryId, setCategoryId] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("expenses").insert({
      supplier_name: supplierName,
      invoice_number: invoiceNumber,
      base_amount: Number(baseAmount),
      vat_rate: Number(vatRate),
      category_id: categoryId || null,
      invoice_date: new Date().toISOString(),
      paid: false,
    });
    setLoading(false);
    if (!error) {
      setSupplierName("");
      setInvoiceNumber("");
      setBaseAmount("");
      setVatRate("21");
      setCategoryId("");
      window.location.reload();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo gasto</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Nº factura</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Base imponible</Label>
            <Input type="number" step="0.01" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>IVA</Label>
            <Select value={vatRate} onValueChange={setVatRate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="4">4%</SelectItem>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="21">21%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Categoría</Label>
            <Input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="UUID opcional" />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar gasto"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
