import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ExpenseForm() {
  const { data: ws } = useCurrentWorkspace();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [vatRate, setVatRate] = useState("21");
  const [categories, setCategories] = useState<{ id: string; name: string; code: string }[]>([]);
  const [categoryCode, setCategoryCode] = useState<string | null>(null);
  const [otherDetail, setOtherDetail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ws) return toast.error("No se ha detectado workspace");
    setLoading(true);
    const { error } = await supabase.from("expenses").insert({
      workspace_id: ws.id,
      entry_type: "gasto",
      supplier_name: supplierName,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
      base_amount: Number(baseAmount),
      vat_rate: Number(vatRate),
      category_id: categoryCode,
      category_other: categoryCode === 'OTROS_GASTOS' ? otherDetail : null,
      paid: false,
      paid_at: null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Gasto creado");
    setSupplierName("");
    setInvoiceNumber("");
    setBaseAmount("");
    setVatRate("21");
    setCategoryCode(null);
    setOtherDetail("");
    qc.invalidateQueries({ queryKey: ["conta-expenses", ws.id] });
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase.from("expense_categories").select("id,name,code").eq("type", "gasto").order("name");
      if (mounted && data) setCategories(data as any);
    }
    load();
    return () => { mounted = false; };
  }, []);

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
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={categoryCode ?? ""} onValueChange={(v) => setCategoryCode(v || null)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                ))}
                <SelectItem value={"OTROS_GASTOS"}>Otros gastos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {categoryCode === 'OTROS_GASTOS' ? (
            <div className="space-y-2 md:col-span-2">
              <Label>Especificar (otros gastos)</Label>
              <Input value={otherDetail} onChange={(e) => setOtherDetail(e.target.value)} />
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar gasto"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
