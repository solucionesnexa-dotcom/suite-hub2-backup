import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { db, downloadTextFile, escapeHtml, renderOnePager, spendCredits } from "@/lib/nexa";
import { Download, FilePlus2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  ssr: false,
  head: () => ({ meta: [{ title: "Diagnostico · Nexa Suite" }] }),
  component: DiagnosticoPage,
});

const questions = [
  ["CRM para gestionar clientes", 2],
  ["Facturacion automatizada", 2],
  ["Gestion de citas o reservas", 2],
  ["Seguimiento de stock", 1],
  ["Comunicacion de novedades a clientes", 2],
  ["Firma digital", 1],
  ["Onboarding definido", 2],
  ["Informes de ventas o rendimiento", 1],
  ["Backup automatizado", 1],
  ["Medicion de tiempo administrativo", 1],
] as const;

const quickWinsByQuestion = [
  "Centralizar clientes y oportunidades en un CRM ligero.",
  "Automatizar facturacion recurrente y avisos de cobro.",
  "Implantar reservas online con recordatorios automaticos.",
  "Crear un control simple de stock con alertas.",
  "Programar comunicaciones recurrentes por email o WhatsApp.",
  "Incorporar firma digital para contratos y autorizaciones.",
  "Documentar un onboarding minimo con checklist.",
  "Crear un dashboard mensual de ventas y rendimiento.",
  "Activar backups automaticos de datos criticos.",
  "Medir tiempos administrativos para priorizar automatizaciones.",
];

function DiagnosticoPage() {
  const { data: ws } = useCurrentWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState({ name: "", sector: "", size: "", website: "" });
  const [tools, setTools] = useState<string[]>([]);
  const [presence, setPresence] = useState<string[]>([]);
  const [answers, setAnswers] = useState<number[]>(questions.map(() => 0));

  const score = useMemo(() => Math.round((answers.reduce((s, n) => s + n, 0) / 15) * 100), [answers]);
  const level = score <= 40 ? "Inicial" : score <= 70 ? "En crecimiento" : "Avanzado";
  const quickWins = useMemo(
    () => answers.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value).slice(0, 3).map((x) => quickWinsByQuestion[x.index]),
    [answers],
  );

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
    queryKey: ["diagnosticos", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db.from("diagnosticos").select("*, clients(name)").eq("workspace_id", ws!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const completeMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      await spendCredits(ws.id, "diagnostico", "Completar y descargar PDF", 3);
      let finalClientId = clientId;
      if (!finalClientId && newClient.name.trim()) {
        const { data, error } = await db
          .from("clients")
          .insert({ workspace_id: ws.id, name: newClient.name, sector: newClient.sector || null, size: newClient.size || null, website: newClient.website || null, status: "diagnostico" })
          .select("id")
          .single();
        if (error) throw error;
        finalClientId = data.id;
      }
      const { data: diag, error } = await db
        .from("diagnosticos")
        .insert({ workspace_id: ws.id, client_id: finalClientId || null, puntuacion: score, quick_wins: quickWins, estado: "completado", creado_por: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      const { error: answerError } = await db.from("diagnostico_respuestas").insert(
        questions.map(([pregunta, max], index) => ({
          diagnostico_id: diag.id,
          pregunta,
          respuesta: String(answers[index]),
          peso: max,
        })),
      );
      if (answerError) throw answerError;
      const body = `<h2>Resultado: ${score}/100 · ${level}</h2>
        <p>Herramientas actuales: ${escapeHtml(tools.join(", ") || "No indicado")}</p>
        <p>Presencia digital: ${escapeHtml(presence.join(", ") || "No indicado")}</p>
        <h2>Quick wins</h2><ul>${quickWins.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`;
      downloadTextFile(`diagnostico-${Date.now()}.html`, renderOnePager("Diagnostico expres digital", body));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnosticos"] });
      qc.invalidateQueries({ queryKey: ["credit-balance"] });
      toast.success("Diagnostico completado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Diagnostico">
      <div className="mx-auto max-w-7xl space-y-6">
        <Tabs defaultValue="nuevo" className="space-y-4">
          <TabsList><TabsTrigger value="nuevo">Nuevo diagnostico</TabsTrigger><TabsTrigger value="historial">Historial</TabsTrigger></TabsList>
          <TabsContent value="nuevo">
            <div className="grid gap-6 xl:grid-cols-[480px_1fr]">
              <Card>
                <CardHeader><CardTitle>Paso 1 · Empresa</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cliente existente</Label>
                    <Select value={clientId || "new"} onValueChange={(v) => setClientId(v === "new" ? "" : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Crear cliente rapido</SelectItem>
                        {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!clientId && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Nombre comercial" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                      <Input placeholder="Sector" value={newClient.sector} onChange={(e) => setNewClient({ ...newClient, sector: e.target.value })} />
                      <Input placeholder="Tamano" value={newClient.size} onChange={(e) => setNewClient({ ...newClient, size: e.target.value })} />
                      <Input placeholder="Web" value={newClient.website} onChange={(e) => setNewClient({ ...newClient, website: e.target.value })} />
                    </div>
                  )}
                  <CheckGroup title="Herramientas digitales" values={["Excel/Google Sheets", "Gmail", "WhatsApp", "Holded", "Factura directa", "Notion", "Otro"]} selected={tools} setSelected={setTools} />
                  <CheckGroup title="Presencia digital" values={["Web propia", "Google My Business", "Redes sociales", "E-commerce"]} selected={presence} setSelected={setPresence} />
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Paso 2 · Cuestionario</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {questions.map(([q, max], index) => (
                      <div key={q} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_140px]">
                        <Label>{index + 1}. {q}</Label>
                        <Select value={String(answers[index])} onValueChange={(v) => setAnswers((prev) => prev.map((x, i) => i === index ? Number(v) : x))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: max + 1 }, (_, n) => <SelectItem key={n} value={String(n)}>{n} / {max}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Paso 3 · Resultado</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                      <div><div className="text-4xl font-semibold text-primary">{score}</div><div className="text-sm text-muted-foreground">{level}</div></div>
                      <div className="pt-4"><Progress value={score} /></div>
                    </div>
                    <ul className="space-y-2 text-sm">{quickWins.map((w) => <li key={w} className="rounded-md border p-3">{w}</li>)}</ul>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => completeMut.mutate()} disabled={completeMut.isPending}><Download className="mr-2 h-4 w-4" /> Descargar PDF</Button>
                      <Button asChild variant="secondary"><Link to="/presupuestos"><FilePlus2 className="mr-2 h-4 w-4" /> Crear propuesta</Link></Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="historial">
            <Card>
              <CardContent className="space-y-3 p-6">
                {history.length === 0 && <p className="text-sm text-muted-foreground">Sin diagnosticos todavia.</p>}
                {history.map((d: any) => (
                  <div key={d.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_120px_120px]">
                    <div><div className="font-medium">{d.clients?.name ?? "Sin cliente"}</div><div className="text-sm text-muted-foreground">{d.fecha}</div></div>
                    <div>{d.puntuacion}/100</div>
                    <div>{d.estado}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function CheckGroup({ title, values, selected, setSelected }: { title: string; values: string[]; selected: string[]; setSelected: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {values.map((value) => (
          <label key={value} className="flex items-center gap-2 rounded-md border p-2 text-sm">
            <Checkbox checked={selected.includes(value)} onCheckedChange={(checked) => setSelected(checked ? [...selected, value] : selected.filter((x) => x !== value))} />
            {value}
          </label>
        ))}
      </div>
    </div>
  );
}
