import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { db, downloadTextFile, eur, renderOnePager, spendCredits } from "@/lib/nexa";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/roi")({
  ssr: false,
  head: () => ({ meta: [{ title: "ROI Calculator · Nexa Suite" }] }),
  component: RoiPage,
});

function RoiPage() {
  const { data: ws } = useCurrentWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre_calculo: "Automatizacion administrativa",
    client_id: "",
    proceso_descripcion: "",
    horas_semana: 8,
    coste_hora: 25,
    semanas_por_ano: 48,
    coste_implantacion: 1200,
  });

  const result = useMemo(() => {
    const annual = form.horas_semana * form.coste_hora * form.semanas_por_ano;
    const saving = annual * 0.8;
    const months = saving > 0 ? form.coste_implantacion / (saving / 12) : 0;
    const roi = form.coste_implantacion > 0 ? ((saving - form.coste_implantacion) / form.coste_implantacion) * 100 : 0;
    return { annual, saving, months, roi };
  }, [form]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-options", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db.from("clients").select("id, name").eq("workspace_id", ws!.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["roi-history", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db.from("roi_calculos").select("*, clients(name)").eq("workspace_id", ws!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      const { error } = await db.from("roi_calculos").insert({
        workspace_id: ws.id,
        client_id: form.client_id || null,
        nombre_calculo: form.nombre_calculo,
        proceso_descripcion: form.proceso_descripcion || "Proceso no descrito",
        horas_semana: form.horas_semana,
        coste_hora: form.coste_hora,
        semanas_por_ano: form.semanas_por_ano,
        coste_implantacion: form.coste_implantacion,
        ahorro_anual_calculado: result.saving,
        roi_meses_calculado: result.months,
        creado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roi-history"] });
      toast.success("Calculo guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download() {
    if (!ws) return;
    try {
      await spendCredits(ws.id, "roi", "Descarga one-pager", 2);
      const body = `<h2>${form.nombre_calculo}</h2>
        <p>${form.proceso_descripcion}</p>
        <table><tr><th>Coste anual actual</th><td>${eur(result.annual)}</td></tr>
        <tr><th>Ahorro anual estimado</th><td>${eur(result.saving)}</td></tr>
        <tr><th>Payback</th><td>${result.months.toFixed(1)} meses</td></tr>
        <tr><th>ROI ano 1</th><td>${result.roi.toFixed(0)}%</td></tr></table>`;
      downloadTextFile(`roi-${Date.now()}.html`, renderOnePager("ROI de automatizacion", body));
      qc.invalidateQueries({ queryKey: ["credit-balance"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function setNumber(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: Number(value) }));
  }

  return (
    <AppShell title="ROI Calculator">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[480px_1fr]">
        <Card>
          <CardHeader><CardTitle>Nuevo calculo ROI</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nombre"><Input value={form.nombre_calculo} onChange={(e) => setForm({ ...form, nombre_calculo: e.target.value })} /></Field>
            <Field label="Cliente opcional">
              <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descripcion del proceso"><Textarea value={form.proceso_descripcion} onChange={(e) => setForm({ ...form, proceso_descripcion: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Horas/semana"><Input type="number" value={form.horas_semana} onChange={(e) => setNumber("horas_semana", e.target.value)} /></Field>
              <Field label="Coste/hora"><Input type="number" value={form.coste_hora} onChange={(e) => setNumber("coste_hora", e.target.value)} /></Field>
              <Field label="Semanas/ano"><Input type="number" value={form.semanas_por_ano} onChange={(e) => setNumber("semanas_por_ano", e.target.value)} /></Field>
              <Field label="Coste implantacion"><Input type="number" value={form.coste_implantacion} onChange={(e) => setNumber("coste_implantacion", e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}><Save className="mr-2 h-4 w-4" /> Guardar calculo</Button>
              <Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" /> Descargar PDF</Button>
              <Button asChild variant="secondary"><Link to="/presupuestos">Crear presupuesto</Link></Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-4">
              <Metric label="Coste anual" value={eur(result.annual)} />
              <Metric label="Ahorro anual" value={eur(result.saving)} />
              <Metric label="Payback" value={`${result.months.toFixed(1)} meses`} />
              <Metric label="ROI ano 1" value={`${result.roi.toFixed(0)}%`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Visualizacion</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><div className="mb-2 text-sm">Ahorro frente al coste actual</div><Progress value={Math.min(100, (result.saving / Math.max(result.annual, 1)) * 100)} /></div>
              <div><div className="mb-2 text-sm">ROI ano 1</div><Progress value={Math.min(100, Math.max(0, result.roi))} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 && <p className="text-sm text-muted-foreground">Sin calculos guardados.</p>}
              {history.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                  <div><div className="font-medium">{item.nombre_calculo}</div><div className="text-sm text-muted-foreground">{item.clients?.name ?? "Sin cliente"}</div></div>
                  <div className="text-right"><div>{eur(item.ahorro_anual_calculado)}</div><div className="text-xs text-muted-foreground">{Number(item.roi_meses_calculado).toFixed(1)} meses</div></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>;
}
