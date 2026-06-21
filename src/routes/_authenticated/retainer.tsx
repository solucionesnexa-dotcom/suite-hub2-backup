import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useCanEdit } from "@/hooks/useCanEdit";
import { db, eur, monthKey } from "@/lib/nexa";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/retainer")({
  ssr: false,
  head: () => ({ meta: [{ title: "Retainer · Nexa Suite" }] }),
  component: RetainerPage,
});

function RetainerPage() {
  const { data: ws } = useCurrentWorkspace();
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-options", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db.from("clients").select("id, name").eq("workspace_id", ws!.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: retainers = [] } = useQuery({
    queryKey: ["retainers", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db.from("retainers").select("*, clients(name), retainer_tareas(*)").eq("workspace_id", ws!.id).order("fecha_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!ws) throw new Error("Sin workspace");
      const { error } = await db.from("retainers").insert({
        workspace_id: ws.id,
        client_id: clientId,
        nombre: String(fd.get("nombre")),
        horas_contratadas_mes: Number(fd.get("horas")),
        importe_mes: Number(fd.get("importe")),
        dia_facturacion: Number(fd.get("dia")),
        notas: String(fd.get("notas") ?? "") || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retainers"] });
      toast.success("Retainer creado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const taskMut = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!selected) throw new Error("Selecciona un retainer");
      const { error } = await db.from("retainer_tareas").insert({
        retainer_id: selected.id,
        mes_ano: monthKey(),
        descripcion: String(fd.get("descripcion")),
        horas_estimadas: Number(fd.get("horas_estimadas")),
        horas_reales: Number(fd.get("horas_reales")),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retainers"] });
      toast.success("Tarea guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Retainer">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[430px_1fr]">
        <Card>
          <CardHeader><CardTitle>Nuevo retainer</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMut.mutate(new FormData(e.currentTarget)); }}>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Selecciona</SelectItem>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input name="nombre" placeholder="Retainer basico" required />
              <div className="grid grid-cols-3 gap-2">
                <Input name="horas" type="number" placeholder="Horas" required />
                <Input name="importe" type="number" placeholder="Importe" required />
                <Input name="dia" type="number" min={1} max={28} defaultValue={1} />
              </div>
              <Textarea name="notas" placeholder="Notas internas" />
              <Button type="submit" disabled={!canEdit || !clientId || createMut.isPending}><Plus className="mr-2 h-4 w-4" /> Crear</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Retainers activos</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {retainers.length === 0 && <p className="text-sm text-muted-foreground">Sin retainers.</p>}
              {retainers.map((r: any) => {
                const tasks = (r.retainer_tareas ?? []).filter((t: any) => t.mes_ano === monthKey());
                const used = tasks.reduce((s: number, t: any) => s + Number(t.horas_reales ?? 0), 0);
                const pct = Math.min(100, (used / Math.max(Number(r.horas_contratadas_mes), 1)) * 100);
                return (
                  <Card key={r.id} className="cursor-pointer p-4" onClick={() => setSelected(r)}>
                    <div className="flex items-start justify-between"><div><div className="font-medium">{r.nombre}</div><div className="text-sm text-muted-foreground">{r.clients?.name}</div></div><Badge>{r.estado}</Badge></div>
                    <div className="mt-4 space-y-2"><div className="flex justify-between text-sm"><span>{used} / {r.horas_contratadas_mes} h</span><span>{eur(r.importe_mes)}</span></div><Progress value={pct} /></div>
                    {pct > 80 && <div className="mt-3 text-sm text-destructive">Mas del 80% consumido.</div>}
                  </Card>
                );
              })}
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader><CardTitle>Detalle · {selected.nombre}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <form className="grid gap-2 md:grid-cols-[1fr_120px_120px_auto]" onSubmit={(e) => { e.preventDefault(); taskMut.mutate(new FormData(e.currentTarget)); e.currentTarget.reset(); }}>
                  <Input name="descripcion" placeholder="Tarea del mes" required />
                  <Input name="horas_estimadas" type="number" placeholder="Estimadas" />
                  <Input name="horas_reales" type="number" placeholder="Reales" />
                  <Button type="submit" disabled={!canEdit}>Anadir</Button>
                </form>
                <div className="space-y-2">
                  {(selected.retainer_tareas ?? []).map((t: any) => <div key={t.id} className="rounded-md border p-3 text-sm">{t.descripcion} · {t.horas_reales}h · {t.estado}</div>)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
