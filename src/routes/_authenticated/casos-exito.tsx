import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useCanEdit } from "@/hooks/useCanEdit";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { generateCaseStudyWithAi } from "@/lib/api/ai.functions";
import { db, downloadTextFile, escapeHtml, getCompanySettings, renderOnePager, spendCredits } from "@/lib/nexa";
import { Copy, Download, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/casos-exito")({
  ssr: false,
  head: () => ({ meta: [{ title: "Casos de Exito · Nexa Suite" }] }),
  component: CasosExitoPage,
});

const toolOptions = ["n8n", "Holded", "WhatsApp Business", "Telegram", "Google Sheets", "Notion", "Otra"];

function CasosExitoPage() {
  const { data: ws } = useCurrentWorkspace();
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    client_id: "",
    cliente_anonimo: false,
    sector: "",
    problema: "",
    solucion: "",
    resultado_cuantificable: "",
  });
  const [tools, setTools] = useState<string[]>([]);
  const [outputs, setOutputs] = useState({ post_linkedin: "", pdf_contenido: "" });

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
    queryKey: ["casos-exito", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db.from("casos_exito").select("*, clients(name)").eq("workspace_id", ws!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      await spendCredits(ws.id, "casos-exito", "Guardar caso de exito", 2);
      const { error } = await db.from("casos_exito").insert({
        workspace_id: ws.id,
        client_id: form.client_id || null,
        cliente_anonimo: form.cliente_anonimo,
        sector: form.sector,
        problema: form.problema,
        solucion: form.solucion,
        herramientas_usadas: tools,
        resultado_cuantificable: form.resultado_cuantificable,
        post_linkedin: outputs.post_linkedin,
        pdf_contenido: outputs.pdf_contenido,
        creado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casos-exito"] });
      qc.invalidateQueries({ queryKey: ["credit-balance"] });
      toast.success("Caso guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function generateLocal() {
    const client = form.cliente_anonimo ? "una empresa del sector" : clients.find((c: any) => c.id === form.client_id)?.name ?? "un cliente";
    setOutputs({
      post_linkedin: `Como ${client} redujo friccion operativa con automatizacion.\n\nEl problema: ${form.problema}\n\nLa solucion: ${form.solucion}\n\nResultado: ${form.resultado_cuantificable}\n\nSi tu equipo sigue resolviendo esto a mano, podemos ayudarte a convertirlo en un flujo medible.`,
      pdf_contenido: `${client} partia de un proceso con cuellos de botella claros: ${form.problema}\n\nNexa diseno e implanto una solucion apoyada en ${tools.join(", ") || "herramientas digitales"}: ${form.solucion}\n\nEl impacto fue tangible: ${form.resultado_cuantificable}. Este caso muestra como una automatizacion bien acotada puede liberar horas y mejorar la calidad del servicio.`,
    });
  }

  const generateMut = useMutation({
    mutationFn: async () =>
      generateCaseStudyWithAi({
        data: {
          cliente: clients.find((c: any) => c.id === form.client_id)?.name ?? "",
          cliente_anonimo: form.cliente_anonimo,
          sector: form.sector,
          problema: form.problema,
          solucion: form.solucion,
          herramientas_usadas: tools,
          resultado_cuantificable: form.resultado_cuantificable,
        },
      }),
    onSuccess: (data: any) => setOutputs(data),
    onError: (e: Error) => {
      toast.error(e.message);
      generateLocal();
    },
  });

  function download() {
    if (!outputs.pdf_contenido) return toast.error("Genera el contenido antes");
    void (async () => {
      const company = ws ? await getCompanySettings(ws.id) : null;
      downloadTextFile(`caso-exito-${Date.now()}.html`, renderOnePager("Caso de exito", `<p>${escapeHtml(outputs.pdf_contenido).replaceAll("\n", "<br/>")}</p>`, company));
    })();
  }

  return (
    <AppShell title="Casos de Exito">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[480px_1fr]">
        <Card>
          <CardHeader><CardTitle>Nuevo caso de exito</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sin cliente</SelectItem>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <label className="flex items-center gap-2 rounded-md border p-2 text-sm"><Checkbox checked={form.cliente_anonimo} onCheckedChange={(v) => setForm({ ...form, cliente_anonimo: Boolean(v) })} /> Mostrar como anonimo</label>
            <Input placeholder="Sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
            <Textarea placeholder="Problema antes de Nexa" value={form.problema} onChange={(e) => setForm({ ...form, problema: e.target.value })} />
            <Textarea placeholder="Solucion implantada" value={form.solucion} onChange={(e) => setForm({ ...form, solucion: e.target.value })} />
            <div className="space-y-2">
              <Label>Herramientas usadas</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {toolOptions.map((tool) => <label key={tool} className="flex items-center gap-2 rounded-md border p-2 text-sm"><Checkbox checked={tools.includes(tool)} onCheckedChange={(checked) => setTools(checked ? [...tools, tool] : tools.filter((x) => x !== tool))} /> {tool}</label>)}
              </div>
            </div>
            <Input placeholder="Resultado cuantificable" value={form.resultado_cuantificable} onChange={(e) => setForm({ ...form, resultado_cuantificable: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generateMut.mutate()} disabled={!canEdit || generateMut.isPending}><Sparkles className="mr-2 h-4 w-4" /> Generar con IA</Button>
              <Button variant="outline" onClick={() => saveMut.mutate()} disabled={!canEdit || saveMut.isPending}><Save className="mr-2 h-4 w-4" /> Guardar</Button>
              <Button variant="secondary" onClick={download}><Download className="mr-2 h-4 w-4" /> PDF</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Outputs editables</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea className="min-h-[160px]" value={outputs.post_linkedin} onChange={(e) => setOutputs({ ...outputs, post_linkedin: e.target.value })} placeholder="Post de LinkedIn" />
              <Textarea className="min-h-[180px]" value={outputs.pdf_contenido} onChange={(e) => setOutputs({ ...outputs, pdf_contenido: e.target.value })} placeholder="Contenido para PDF" />
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(outputs.post_linkedin)}><Copy className="mr-2 h-4 w-4" /> Copiar post</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {history.map((item: any) => <div key={item.id} className="rounded-md border p-3 text-sm"><strong>{item.clients?.name ?? "Anonimo"}</strong> · {item.sector ?? "Sin sector"} · {item.resultado_cuantificable}</div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
