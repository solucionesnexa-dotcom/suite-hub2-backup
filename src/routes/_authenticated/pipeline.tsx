import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { daysSince, db, pipelineColumns } from "@/lib/nexa";
import { AlertCircle, CalendarClock, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pipeline · Nexa Suite" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  const { data: ws } = useCurrentWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["pipeline-clients", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db
        .from("clients")
        .select("id, name, sector, status, last_contact_at, updated_at")
        .eq("workspace_id", ws!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["pipeline-notes", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("pipeline_notas")
        .select("*")
        .eq("client_id", selected.id)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const moveMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await db
        .from("clients")
        .update({ status, last_contact_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-clients"] });
      toast.success("Estado actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNoteMut = useMutation({
    mutationFn: async (nota: string) => {
      if (!selected) throw new Error("Selecciona un cliente");
      const { error } = await db.from("pipeline_notas").insert({
        client_id: selected.id,
        user_id: user?.id ?? null,
        nota,
        tipo: "nota",
      });
      if (error) throw error;
      await db.from("clients").update({ last_contact_at: new Date().toISOString() }).eq("id", selected.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-notes"] });
      qc.invalidateQueries({ queryKey: ["pipeline-clients"] });
      toast.success("Nota guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Pipeline">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pipeline de clientes</h2>
          <p className="text-sm text-muted-foreground">Ciclo comercial de Nexa desde prospecto hasta retainer.</p>
        </div>
        <div className="grid gap-4 overflow-x-auto xl:grid-cols-4 2xl:grid-cols-8">
          {pipelineColumns.map((column) => {
            const items = clients.filter((c: any) => (c.status ?? "prospecto") === column.value);
            return (
              <div key={column.value} className="min-w-[230px] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{column.label}</h3>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="space-y-3">
                  {items.map((client: any) => {
                    const stale = daysSince(client.last_contact_at ?? client.updated_at);
                    const urgent =
                      stale > 14 && ["diagnostico", "propuesta_enviada", "negociacion"].includes(column.value);
                    return (
                      <Card key={client.id} className="cursor-pointer p-3 hover:bg-accent/50" onClick={() => setSelected(client)}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-xs text-muted-foreground">{client.sector ?? "Sin sector"}</div>
                          </div>
                          {urgent && <AlertCircle className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {Number.isFinite(stale) ? `${stale} dias` : "Sin actividad"}
                          </span>
                          <Badge variant={stale > 7 ? "destructive" : "outline"}>{stale > 7 ? "+7d" : "OK"}</Badge>
                        </div>
                      </Card>
                    );
                  })}
                  {items.length === 0 && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Sin clientes.</div>}
                </div>
              </div>
            );
          })}
        </div>

        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{selected?.name}</SheetTitle>
            </SheetHeader>
            {selected && (
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label>Estado del pipeline</Label>
                  <Select value={selected.status ?? "prospecto"} onValueChange={(status) => moveMut.mutate({ id: selected.id, status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pipelineColumns.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const nota = String(fd.get("nota") ?? "").trim();
                    if (nota) addNoteMut.mutate(nota);
                    e.currentTarget.reset();
                  }}
                >
                  <Label>Nueva nota</Label>
                  <Textarea name="nota" placeholder="Resumen de llamada, reunion o siguiente paso..." />
                  <Button type="submit" disabled={addNoteMut.isPending}>
                    <MessageSquarePlus className="mr-2 h-4 w-4" /> Guardar nota
                  </Button>
                </form>
                <div className="space-y-3">
                  <h3 className="font-semibold">Actividad</h3>
                  {notes.length === 0 && <p className="text-sm text-muted-foreground">Sin notas todavia.</p>}
                  {notes.map((note: any) => (
                    <div key={note.id} className="rounded-md border p-3">
                      <div className="text-sm">{note.nota}</div>
                      <div className="mt-2 text-xs text-muted-foreground">{new Date(note.fecha).toLocaleString("es-ES")}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}
