import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Wallet, Receipt, Pencil, Trash2, Plus, Calculator } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/contanexa")({
  ssr: false,
  head: () => ({ meta: [{ title: "ContaNexa · Nexa Suite" }] }),
  component: ContaNexaPage,
});

type EntryType = "gasto" | "ingreso";

interface ExpenseRow {
  id: string;
  workspace_id: string;
  entry_type: EntryType;
  description: string;
  category_id: string | null;
  category_other: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string;
  base_amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  payment_method: string | null;
  is_deductible: boolean;
  notes: string | null;
  source?: string;
}

interface CategoryRow {
  id: string;
  name: string;
  type: EntryType;
  color: string | null;
}

interface TaxPeriodRow {
  id: string;
  year: number;
  quarter: number;
  income: number;
  expenses: number;
  vat_collected: number;
  vat_paid: number;
  vat_result: number;
  irpf_estimated: number;
  irpf_rate: number;
  notes: string | null;
  calculated_at: string | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_QUARTER = Math.floor(new Date().getMonth() / 3) + 1;

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

function quarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function ContaNexaPage() {
  const { data: workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id;

  const [year, setYear] = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState(CURRENT_QUARTER);

  const range = useMemo(() => quarterRange(year, quarter), [year, quarter]);

  const expensesQ = useQuery({
  queryKey: ["conta-expenses", workspaceId, year, quarter],
  enabled: !!workspaceId,
  queryFn: async () => {
    const [manualRes, facturasRes] = await Promise.all([
      supabase.from("expenses").select("*")
        .eq("workspace_id", workspaceId!)
        .gte("invoice_date", range.start).lte("invoice_date", range.end),
      supabase.from("v_conta_ingresos").select("*")
        .eq("workspace_id", workspaceId!)
        .gte("invoice_date", range.start).lte("invoice_date", range.end),
    ]);
    if (manualRes.error) throw manualRes.error;
    if (facturasRes.error) throw facturasRes.error;
    return [...(manualRes.data ?? []), ...(facturasRes.data ?? [])] as ExpenseRow[];
  },
});

  const categoriesQ = useQuery({
    queryKey: ["conta-categories", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const periodsQ = useQuery({
    queryKey: ["conta-periods", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_periods")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("year", { ascending: false })
        .order("quarter", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaxPeriodRow[];
    },
  });

  const rows = expensesQ.data ?? [];
  const cats = categoriesQ.data ?? [];

  const stats = useMemo(() => {
    const income = rows.filter((r) => r.entry_type === "ingreso");
    const expenses = rows.filter((r) => r.entry_type === "gasto");
    const totalIncome = income.reduce((s, r) => s + Number(r.base_amount), 0);
    const totalExpenses = expenses.reduce((s, r) => s + Number(r.base_amount), 0);
    const vatCollected = income.reduce((s, r) => s + Number(r.vat_amount), 0);
    const vatPaid = expenses.filter((r) => r.is_deductible).reduce((s, r) => s + Number(r.vat_amount), 0);
    const profit = totalIncome - totalExpenses;
    return {
      totalIncome,
      totalExpenses,
      vatCollected,
      vatPaid,
      vatResult: vatCollected - vatPaid,
      profit,
      irpfEstimated: profit > 0 ? profit * 0.15 : 0,
    };
  }, [rows]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    rows.filter((r) => r.entry_type === "gasto").forEach((r) => {
      const cat = cats.find((c) => c.id === r.category_id);
      const name = cat?.name ?? r.category_other ?? "Sin categoría";
      const prev = map.get(name);
      map.set(name, {
        name,
        value: (prev?.value ?? 0) + Number(r.base_amount),
        color: cat?.color ?? "#6b7280",
      });
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [rows, cats]);

  const monthlySeries = useMemo(() => {
    const months = [0, 1, 2].map((offset) => {
      const monthIdx = (quarter - 1) * 3 + offset;
      const label = new Date(year, monthIdx, 1).toLocaleDateString("es-ES", { month: "short" });
      return { name: label, monthIdx, ingresos: 0, gastos: 0 };
    });
    rows.forEach((r) => {
      const m = new Date(r.invoice_date).getMonth();
      const bucket = months.find((x) => x.monthIdx === m);
      if (!bucket) return;
      if (r.entry_type === "ingreso") bucket.ingresos += Number(r.base_amount);
      else bucket.gastos += Number(r.base_amount);
    });
    return months;
  }, [rows, year, quarter]);

  return (
    <AppShell title="ContaNexa">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Contabilidad</h2>
            <p className="text-sm text-muted-foreground">
              Movimientos, IVA e IRPF por trimestre — {year} T{quarter}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((q) => (
                  <SelectItem key={q} value={String(q)}>T{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <StatsCards stats={stats} quarter={quarter} year={year} />

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
            <TabsTrigger value="trimestres">Trimestres</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ingresos vs Gastos — T{quarter} {year}</CardTitle>
                  <CardDescription>Base imponible mensual</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySeries}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => eur(v)} />
                      <Legend />
                      <Bar dataKey="ingresos" fill="#10b981" />
                      <Bar dataKey="gastos" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gastos por categoría</CardTitle>
                  <CardDescription>Distribución en el periodo</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {byCategory.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Sin gastos en el periodo
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
                          {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => eur(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="movimientos">
            <MovementsTable
              rows={rows}
              categories={cats}
              workspaceId={workspaceId}
              loading={expensesQ.isLoading}
            />
          </TabsContent>

          <TabsContent value="trimestres">
            <PeriodsTable
              periods={periodsQ.data ?? []}
              workspaceId={workspaceId}
              stats={stats}
              year={year}
              quarter={quarter}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function StatsCards({
  stats,
  quarter,
  year,
}: {
  stats: {
    totalIncome: number;
    totalExpenses: number;
    vatCollected: number;
    vatPaid: number;
    vatResult: number;
    profit: number;
    irpfEstimated: number;
  };
  quarter: number;
  year: number;
}) {
  const suffix = ` (T${quarter} ${year})`;
  const cards = [
    { label: `Ingresos${suffix}`, value: stats.totalIncome, icon: TrendingUp, tone: "text-emerald-600" },
    { label: `Gastos${suffix}`, value: stats.totalExpenses, icon: TrendingDown, tone: "text-rose-600" },
    { label: `Beneficio${suffix}`, value: stats.profit, icon: Wallet, tone: stats.profit >= 0 ? "text-emerald-600" : "text-rose-600" },
    { label: `IVA a liquidar${suffix}`, value: stats.vatResult, icon: Receipt, tone: stats.vatResult >= 0 ? "text-amber-600" : "text-emerald-600" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.tone}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold tabular-nums ${c.tone}`}>{eur(c.value)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface MovementDraft {
  id?: string;
  entry_type: EntryType;
  description: string;
  category_id: string | null;
  category_other: string;
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  base_amount: number;
  vat_rate: number;
  payment_method: string;
  is_deductible: boolean;
  notes: string;
}

const emptyDraft = (type: EntryType = "gasto"): MovementDraft => ({
  entry_type: type,
  description: "",
  category_id: null,
  category_other: "",
  supplier_name: "",
  invoice_number: "",
  invoice_date: new Date().toISOString().slice(0, 10),
  base_amount: 0,
  vat_rate: 21,
  payment_method: "transferencia",
  is_deductible: true,
  notes: "",
});

function MovementsTable({
  rows, categories, workspaceId, loading,
}: {
  rows: ExpenseRow[];
  categories: CategoryRow[];
  workspaceId: string | undefined;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MovementDraft>(emptyDraft());

  const openNew = (type: EntryType) => { setDraft(emptyDraft(type)); setOpen(true); };
  const openEdit = (r: ExpenseRow) => {
    setDraft({
      id: r.id,
      entry_type: r.entry_type,
      description: r.description,
      category_id: r.category_id,
      category_other: r.category_other ?? "",
      supplier_name: r.supplier_name ?? "",
      invoice_number: r.invoice_number ?? "",
      invoice_date: r.invoice_date,
      base_amount: Number(r.base_amount),
      vat_rate: Number(r.vat_rate),
      payment_method: r.payment_method ?? "transferencia",
      is_deductible: r.is_deductible,
      notes: r.notes ?? "",
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async (d: MovementDraft) => {
      if (!workspaceId) throw new Error("Sin workspace");
      const payload = {
        workspace_id: workspaceId,
        entry_type: d.entry_type,
        description: d.description,
        category_id: d.category_id,
        category_other: d.category_other || null,
        supplier_name: d.supplier_name || null,
        invoice_number: d.invoice_number || null,
        invoice_date: d.invoice_date,
        base_amount: d.base_amount,
        vat_rate: d.vat_rate,
        payment_method: d.payment_method,
        is_deductible: d.is_deductible,
        notes: d.notes || null,
      };
      if (d.id) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Movimiento guardado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["conta-expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimiento eliminado");
      qc.invalidateQueries({ queryKey: ["conta-expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const availableCats = categories.filter((c) => c.type === draft.entry_type);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Movimientos del periodo</CardTitle>
          <CardDescription>{rows.length} registros</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openNew("ingreso")}>
            <Plus className="mr-1 h-4 w-4" />Ingreso
          </Button>
          <Button size="sm" onClick={() => openNew("gasto")}>
            <Plus className="mr-1 h-4 w-4" />Gasto
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay movimientos en este trimestre. Añade uno para comenzar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const cat = categories.find((c) => c.id === r.category_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.invoice_date}</TableCell>
                      <TableCell>
                        <Badge variant={r.entry_type === "ingreso" ? "default" : "secondary"}>
                          {r.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cat?.name ?? r.category_other ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{eur(Number(r.base_amount))}</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(Number(r.vat_amount))}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{eur(Number(r.total_amount))}</TableCell>
                      <TableCell className="text-right">
                      {r.source !== "factura" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("¿Eliminar este movimiento?")) delMut.mutate(r.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar" : "Nuevo"} {draft.entry_type}</DialogTitle>
            <DialogDescription>Los importes de IVA y total se calculan automáticamente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Descripción</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={draft.invoice_date} onChange={(e) => setDraft({ ...draft, invoice_date: e.target.value })} />
            </div>
            <div>
              <Label>{draft.entry_type === "gasto" ? "Proveedor" : "Cliente"}</Label>
              <Input value={draft.supplier_name} onChange={(e) => setDraft({ ...draft, supplier_name: e.target.value })} />
            </div>
            <div>
              <Label>Nº factura</Label>
              <Input value={draft.invoice_number} onChange={(e) => setDraft({ ...draft, invoice_number: e.target.value })} />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select
                value={draft.category_id ?? "__none"}
                onValueChange={(v) => setDraft({ ...draft, category_id: v === "__none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin categoría</SelectItem>
                  {availableCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base imponible (€)</Label>
              <Input type="number" step="0.01" value={draft.base_amount}
                onChange={(e) => setDraft({ ...draft, base_amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tipo IVA (%)</Label>
              <Select value={String(draft.vat_rate)} onValueChange={(v) => setDraft({ ...draft, vat_rate: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 4, 10, 21].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={draft.payment_method} onValueChange={(v) => setDraft({ ...draft, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["transferencia", "tarjeta", "bizum", "efectivo", "paypal", "sepa"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 rounded-md bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span>Base: <b>{eur(draft.base_amount)}</b></span>
                <span>IVA: <b>{eur((draft.base_amount * draft.vat_rate) / 100)}</b></span>
                <span>Total: <b>{eur(draft.base_amount * (1 + draft.vat_rate / 100))}</b></span>
              </div>
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMut.mutate(draft)}
              disabled={saveMut.isPending || !draft.description || !draft.base_amount}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PeriodsTable({
  periods, workspaceId, stats, year, quarter,
}: {
  periods: TaxPeriodRow[];
  workspaceId: string | undefined;
  stats: {
    totalIncome: number; totalExpenses: number; vatCollected: number;
    vatPaid: number; vatResult: number; profit: number; irpfEstimated: number;
  };
  year: number;
  quarter: number;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TaxPeriodRow | null>(null);

  const calcMut = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Sin workspace");
      const payload = {
        workspace_id: workspaceId,
        year,
        quarter,
        income: stats.totalIncome,
        expenses: stats.totalExpenses,
        vat_collected: stats.vatCollected,
        vat_paid: stats.vatPaid,
        vat_result: stats.vatResult,
        irpf_estimated: stats.irpfEstimated,
        irpf_rate: 15,
        calculated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("tax_periods")
        .upsert(payload, { onConflict: "workspace_id,year,quarter" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`T${quarter} ${year} recalculado`);
      qc.invalidateQueries({ queryKey: ["conta-periods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: async (p: TaxPeriodRow) => {
      const { error } = await supabase.from("tax_periods").update({
        income: p.income, expenses: p.expenses,
        vat_collected: p.vat_collected, vat_paid: p.vat_paid,
        vat_result: p.vat_collected - p.vat_paid,
        irpf_rate: p.irpf_rate,
        irpf_estimated: Math.max(0, (p.income - p.expenses) * (p.irpf_rate / 100)),
        notes: p.notes,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Periodo actualizado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["conta-periods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Cierres trimestrales</CardTitle>
          <CardDescription>Resúmenes fiscales calculados y editables</CardDescription>
        </div>
        <Button size="sm" onClick={() => calcMut.mutate()} disabled={calcMut.isPending}>
          <Calculator className="mr-1 h-4 w-4" />Calcular T{quarter} {year}
        </Button>
      </CardHeader>
      <CardContent>
        {periods.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Sin cierres. Pulsa "Calcular" para guardar el periodo actual.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">IVA rep.</TableHead>
                <TableHead className="text-right">IVA sop.</TableHead>
                <TableHead className="text-right">IVA a liquidar</TableHead>
                <TableHead className="text-right">IRPF est.</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>T{p.quarter} {p.year}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(Number(p.income))}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(Number(p.expenses))}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(Number(p.vat_collected))}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(Number(p.vat_paid))}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{eur(Number(p.vat_result))}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(Number(p.irpf_estimated))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar T{editing?.quarter} {editing?.year}</DialogTitle>
            <DialogDescription>Ajusta manualmente los importes del cierre.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              {(["income", "expenses", "vat_collected", "vat_paid", "irpf_rate"] as const).map((k) => (
                <div key={k}>
                  <Label className="capitalize">{k.replace("_", " ")}</Label>
                  <Input
                    type="number" step="0.01"
                    value={editing[k] as number}
                    onChange={(e) => setEditing({ ...editing, [k]: Number(e.target.value) })}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <Label>Notas</Label>
                <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && saveMut.mutate(editing)} disabled={saveMut.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
