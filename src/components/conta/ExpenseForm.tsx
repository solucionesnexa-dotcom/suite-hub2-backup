import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Category = {
  id: string;
  name: string;
  code: string;
  type: string;
};

export default function ExpenseForm() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_name: "",
    supplier_nif: "",
    invoice_number: "",
    invoice_date: "",
    due_date: "",
    category_id: "",
    base_amount: "",
    vat_rate: "21",
    payment_method: "transferencia",
    notes: "",
  });

  useEffect(() => {
    supabase
      .from("expense_categories")
      .select("id, name, code, type")
      .order("name")
      .then(({ data }) => setCategories((data as Category[]) ?? []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    await supabase.from("expenses").insert({
      ...form,
      base_amount: Number(form.base_amount),
      vat_rate: Number(form.vat_rate),
      category_id: form.category_id || null,
      due_date: form.due_date || null,
      supplier_nif: form.supplier_nif || null,
      invoice_number: form.invoice_number || null,
      notes: form.notes || null,
    });

    setForm({
      supplier_name: "",
      supplier_nif: "",
      invoice_number: "",
      invoice_date: "",
      due_date: "",
      category_id: "",
      base_amount: "",
      vat_rate: "21",
      payment_method: "transferencia",
      notes: "",
    });

    setSaving(false);
    window.location.reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo gasto</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Proveedor</Label>
            <Input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} required />
          </div>

          <div className="grid gap-2">
            <Label>NIF proveedor</Label>
            <Input value={form.supplier_nif} onChange={(e) => setForm({ ...form, supplier_nif: e.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label>Nº factura</Label>
            <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label>Fecha factura</Label>
            <Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required />
          </div>

          <div className="grid gap-2">
            <Label>Vencimiento</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label>Categoría</Label>
            <Select value={form.category_id} onValueChange={(value) => setForm({ ...form, category_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label Base>Base imponible</Label>
            <Input type="number" step="0.01" value={form.base_amount} onChange={(e) => setForm({ ...form, base_amount: e.target.value })} required />
          </div>

          <div className="grid gap-2">
            <Label>IVA %</Label>
            <Input type="number" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label>Método de pago</Label>
            <Select value={form.payment_method} onValueChange={(value) => setForm({ ...form, payment_method: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="domiciliacion">Domiciliación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label>Notas</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar gasto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}