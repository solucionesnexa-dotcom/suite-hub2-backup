import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PaginationBar } from "@/components/PaginationBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useCanEdit } from "@/hooks/useCanEdit";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { db, downloadPdfFile, escapeHtml, eur, getCompanySettings, serviceCatalog, spendCredits, today } from "@/lib/nexa";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/presupuestos")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    client: typeof search.client === "string" ? search.client : "",
    note: typeof search.note === "string" ? search.note : "",
  }),
  head: () => ({ meta: [{ title: "Presupuestos · Nexa Suite" }] }),
  component: PresupuestosPage,
});

type Line = { descripcion: string; tipo: string; importe: number; cantidad: number };

function PresupuestosPage() {
  const searchParams = Route.useSearch();
  const { data: ws } = useCurrentWorkspace();
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ descripcion: "Automatizacion basica", tipo: "servicio_unico", importe: 150, cantidad: 1 }]);

  useEffect(() => {
    if (searchParams.client) setClientId(searchParams.client);
    if (searchParams.note) setNotes((prev) => prev || searchParams.note);
  }, [searchParams.client, searchParams.note]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.importe * l.cantidad, 0);
    return { subtotal, total: subtotal * (1 - discount / 100) };
  }, [lines, discount]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-options", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db.from("clients").select("id, name, tax_id, email").eq("workspace_id", ws!.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["presupuestos", ws?.id, statusFilter, page],
    enabled: !!ws,
    queryFn: async () => {
      let query = db.from("presupuestos").select("*, clients(name)").eq("workspace_id", ws!.id);
      if (statusFilter !== "todos") query = query.eq("estado", statusFilter);
      const { data, error } = await query.order("fecha", { ascending: false }).range(page * 20, page * 20 + 19);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      if (!clientId) throw new Error("Selecciona un cliente");
      const year = new Date().getFullYear();
      const { count, error: countError } = await db
        .from("presupuestos")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws.id)
        .gte("fecha", `${year}-01-01`)
        .lte("fecha", `${year}-12-31`);
      if (countError) throw countError;
      const number = `PS-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;
      const { data: budget, error } = await db
        .from("presupuestos")
        .insert({
          workspace_id: ws.id,
          client_id: clientId,
          numero: number,
          fecha: today(),
          descuento_pct: discount,
          subtotal: totals.subtotal,
          total: totals.total,
          notas_cliente: notes,
          creado_por: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const { error: lineError } = await db.from("presupuesto_lineas").insert(
        lines.map((l) => ({
          presupuesto_id: budget.id,
          descripcion: l.descripcion,
          tipo: l.tipo,
          importe: l.importe,
          cantidad: l.cantidad,
          total_linea: l.importe * l.cantidad,
        })),
      );
      if (lineError) throw lineError;
      return budget;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presupuestos"] });
      toast.success("Presupuesto guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { error } = await db.from("presupuestos").update({ estado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presupuestos"] }),
  });

  async function download() {
    if (!ws) return;
    try {
      await spendCredits(ws.id, "presupuestos", "Descarga PDF", 1);
      const company = await getCompanySettings(ws.id);
      const client = clients.find((c: any) => c.id === clientId);
      const rows = lines
        .map((l) => `<tr><td>${escapeHtml(l.descripcion)}</td><td>${l.cantidad}</td><td>${eur(l.importe)}</td><td>${eur(l.importe * l.cantidad)}</td></tr>`)
        .join("");
      const body = `<h2>Propuesta para ${escapeHtml(client?.name ?? "cliente")}</h2>
        <table><thead><tr><th>Servicio</th><th>Cantidad</th><th>Importe</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Descuento: ${discount}%</p><p class="total">Total: ${eur(totals.total)}</p><p>${escapeHtml(notes)}</p>`;
      downloadPdfFile(`presupuesto-${Date.now()}.pdf`, "Propuesta comercial Nexa", body, company);
      qc.invalidateQueries({ queryKey: ["credit-balance"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const visibleBudgets = budgets.filter((budget: any) =>
    `${budget.numero} ${budget.clients?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell title="Presupuestos">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[520px_1fr]">
        <Card>
          <CardHeader><CardTitle>Nuevo presupuesto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecciona cliente</SelectItem>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Lineas</Label>
                <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => setLines([...lines, { descripcion: "", tipo: "otro", importe: 0, cantidad: 1 }])}>
                  <Plus className="mr-2 h-4 w-4" /> Linea
                </Button>
              </div>
              {lines.map((line, index) => (
                <div key={index} className="space-y-2 rounded-md border p-3">
                  <Select
                    value={serviceCatalog.find((s) => s.descripcion === line.descripcion)?.descripcion ?? "custom"}
                    onValueChange={(value) => {
                      const item = serviceCatalog.find((s) => s.descripcion === value);
                      if (item) updateLine(index, { descripcion: item.descripcion, tipo: item.tipo, importe: item.importe });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Linea personalizada</SelectItem>
                      {serviceCatalog.map((s) => <SelectItem key={s.descripcion} value={s.descripcion}>{s.descripcion} · {eur(s.importe)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={line.descripcion} onChange={(e) => updateLine(index, { descripcion: e.target.value })} placeholder="Descripcion" />
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input type="number" value={line.importe} onChange={(e) => updateLine(index, { importe: Number(e.target.value) })} />
                    <Input type="number" value={line.cantidad} onChange={(e) => updateLine(index, { cantidad: Number(e.target.value) })} />
                    <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Descuento %</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{eur(totals.total)}</div></div>
            </div>
            <div className="space-y-2"><Label>Notas cliente</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveMut.mutate()} disabled={!canEdit || saveMut.isPending}><Save className="mr-2 h-4 w-4" /> Guardar</Button>
              <Button variant="outline" onClick={download} disabled={!canEdit}><Download className="mr-2 h-4 w-4" /> Descargar PDF</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar presupuesto..." className="max-w-xs" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {["borrador", "enviado", "aceptado", "rechazado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {visibleBudgets.length === 0 && <p className="text-sm text-muted-foreground">Sin presupuestos en esta vista.</p>}
            {visibleBudgets.map((budget: any) => (
              <div key={budget.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_140px_160px]">
                <div><div className="font-medium">{budget.numero} · {budget.clients?.name ?? "Cliente"}</div><div className="text-sm text-muted-foreground">{budget.fecha}</div></div>
                <div className="font-semibold">{eur(budget.total)}</div>
                <Select value={budget.estado} disabled={!canEdit} onValueChange={(estado) => statusMut.mutate({ id: budget.id, estado })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["borrador", "enviado", "aceptado", "rechazado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <PaginationBar page={page} count={budgets.length} onPageChange={setPage} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
