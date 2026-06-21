import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useCanEdit } from "@/hooks/useCanEdit";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { generateSopWithAi } from "@/lib/api/ai.functions";
import { db, downloadTextFile, escapeHtml, getCompanySettings, renderOnePager, spendCredits } from "@/lib/nexa";
import { Download, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sop")({
  ssr: false,
  head: () => ({ meta: [{ title: "SOP · Nexa Suite" }] }),
  component: SopPage,
});

function SopPage() {
  const { data: ws } = useCurrentWorkspace();
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [responsable, setResponsable] = useState("");
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<any | null>(null);

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
    queryKey: ["sops", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db.from("sops").select("*, clients(name)").eq("workspace_id", ws!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      if (!result) throw new Error("Estructura el SOP antes de guardar");
      await spendCredits(ws.id, "sop", "Guardar SOP", 2);
      const { error } = await db.from("sops").insert({
        workspace_id: ws.id,
        client_id: clientId || null,
        titulo,
        objetivo: result.objetivo,
        responsable: result.responsable,
        proceso_descripcion_raw: raw,
        pasos: result.pasos,
        entregable: result.entregable,
        estado: "finalizado",
        creado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sops"] });
      qc.invalidateQueries({ queryKey: ["credit-balance"] });
      toast.success("SOP guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function download() {
    if (!result) return toast.error("Estructura el SOP antes");
    const steps = result.pasos.map((p: any) => `<li><strong>${p.numero}. ${escapeHtml(p.descripcion)}</strong><br/>Entrada: ${escapeHtml(p.condicion_entrada)}<br/>Herramienta: ${escapeHtml(p.herramienta)}</li>`).join("");
    void (async () => {
      const company = ws ? await getCompanySettings(ws.id) : null;
      downloadTextFile(`sop-${Date.now()}.html`, renderOnePager(titulo || "SOP", `<h2>${escapeHtml(result.objetivo)}</h2><ol>${steps}</ol><p><strong>Entregable:</strong> ${escapeHtml(result.entregable)}</p>`, company));
    })();
  }

  const aiMut = useMutation({
    mutationFn: async () => generateSopWithAi({ data: { titulo, responsable, descripcion: raw } }),
    onSuccess: (data) => setResult(data),
    onError: (e: Error) => {
      toast.error(e.message);
      setResult(structureSop(raw, responsable));
    },
  });

  return (
    <AppShell title="SOP">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[480px_1fr]">
        <Card>
          <CardHeader><CardTitle>Generador de SOP</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Titulo del SOP" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Cliente opcional" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sin cliente</SelectItem>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} />
            <Textarea className="min-h-[180px]" placeholder="Describe el proceso con tus palabras..." value={raw} onChange={(e) => setRaw(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => aiMut.mutate()} disabled={!canEdit || aiMut.isPending}><Sparkles className="mr-2 h-4 w-4" /> Estructurar SOP</Button>
              <Button variant="outline" onClick={() => saveMut.mutate()} disabled={!canEdit || saveMut.isPending}><Save className="mr-2 h-4 w-4" /> Guardar</Button>
              <Button variant="secondary" onClick={download}><Download className="mr-2 h-4 w-4" /> Descargar PDF</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Resultado editable</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!result && <p className="text-sm text-muted-foreground">El SOP estructurado aparecera aqui.</p>}
              {result && (
                <>
                  <div className="space-y-2"><Label>Objetivo</Label><Textarea value={result.objetivo} onChange={(e) => setResult({ ...result, objetivo: e.target.value })} /></div>
                  {result.pasos.map((step: any, index: number) => (
                    <div key={step.numero} className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                      <Input value={step.descripcion} onChange={(e) => updateStep(index, { descripcion: e.target.value })} />
                      <Input value={step.condicion_entrada} onChange={(e) => updateStep(index, { condicion_entrada: e.target.value })} />
                    </div>
                  ))}
                  <Textarea value={result.entregable} onChange={(e) => setResult({ ...result, entregable: e.target.value })} />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {history.map((s: any) => <div key={s.id} className="rounded-md border p-3 text-sm"><strong>{s.titulo}</strong> · {s.clients?.name ?? "Sin cliente"} · {s.estado}</div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );

  function updateStep(index: number, patch: any) {
    setResult((prev: any) => ({ ...prev, pasos: prev.pasos.map((p: any, i: number) => i === index ? { ...p, ...patch } : p) }));
  }
}

function structureSop(raw: string, responsable: string) {
  const fragments = raw.split(/[.\n;]/).map((x) => x.trim()).filter(Boolean);
  const base = fragments.length ? fragments : ["Recibir solicitud", "Validar datos", "Ejecutar tarea", "Revisar resultado", "Comunicar cierre"];
  const pasos = Array.from({ length: Math.max(5, Math.min(8, base.length)) }, (_, i) => ({
    numero: i + 1,
    descripcion: base[i] ?? `Completar actividad ${i + 1}`,
    condicion_entrada: i === 0 ? "Solicitud recibida" : `Paso ${i} completado`,
    condicion_salida: `Paso ${i + 1} validado`,
    herramienta: "Nexa Suite / herramienta operativa",
  }));
  return {
    objetivo: raw ? `Estandarizar el proceso descrito para reducir errores y asegurar seguimiento.` : "Estandarizar el proceso operativo.",
    responsable: responsable || "Responsable del proceso",
    pasos,
    entregable: "Proceso completado, documentado y comunicado al cliente interno o externo.",
  };
}
