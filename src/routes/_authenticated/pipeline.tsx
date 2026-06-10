import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Clock, FileSpreadsheet, FileText, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pipeline · Nexa Suite" }] }),
  component: PipelinePage,
});

const ALL_FILTER_VALUE = "__all__";

const columns = [
  { value: "prospecto", label: "Prospecto" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "propuesta_enviada", label: "Propuesta enviada" },
  { value: "negociacion", label: "Negociación" },
  { value: "cerrado", label: "Cerrado" },
  { value: "retainer_activo", label: "Retainer activo" },
  { value: "pausado", label: "Pausado" },
  { value: "perdido", label: "Perdido" },
] as const;

type PipelineStatus = (typeof columns)[number]["value"];

type Client = {
  id: string;
  name: string;
  nombre_comercial: string | null;
  sector: string | null;
  estado: string;
  email: string | null;
  phone: string | null;
  updated_at: string;
  created_at: string;
};

type PipelineNote = {
  id: string;
  cliente_id: string;
  user_id: string;
  nota: string;
  tipo: string;
  fecha: string;
};

const activeAttentionStates = new Set(["diagnostico", "propuesta_enviada", "negociacion"]);

function PipelinePage() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const canEdit = profile?.rol_global !== "viewer";

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const [clientsRes, notesRes, invoicesRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, nombre_comercial, sector, estado, email, phone, created_at, updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("pipeline_notas").select("*").order("fecha", { ascending: false }).limit(500),
        supabase
          .from("invoices")
          .select("id, client_id, status")
          .in("status", ["pending", "included"]),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      const notes = notesRes.error ? [] : ((notesRes.data ?? []) as PipelineNote[]);

      return {
        clients: (clientsRes.data ?? []) as Client[],
        notes,
        openInvoicesByClient: (invoicesRes.data ?? []).reduce<Map<string, number>>((map, inv) => {
          map.set(inv.client_id, (map.get(inv.client_id) ?? 0) + 1);
          return map;
        }, new Map()),
      };
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ clientId, estado }: { clientId: string; estado: PipelineStatus }) => {
      const { error } = await supabase.from("clients").update({ estado }).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const addNoteMut = useMutation({
    mutationFn: async ({
      clientId,
      tipo,
      nota,
    }: {
      clientId: string;
      tipo: string;
      nota: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sesión no disponible");
      const { error } = await supabase.from("pipeline_notas").insert({
        cliente_id: clientId,
        user_id: userRes.user.id,
        tipo,
        nota,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota añadida");
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clients = data?.clients ?? [];
  const notes = data?.notes ?? [];
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  const sectors = useMemo(
    () => Array.from(new Set(clients.map((client) => client.sector).filter(Boolean))) as string[],
    [clients],
  );

  const latestNoteByClient = useMemo(() => {
    const map = new Map<string, PipelineNote>();
    for (const note of notes) if (!map.has(note.cliente_id)) map.set(note.cliente_id, note);
    return map;
  }, [notes]);

  const filteredClients = clients.filter((client) => {
    const text = `${client.name} ${client.nombre_comercial ?? ""} ${client.sector ?? ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!sector || client.sector === sector);
  });

  function normalizedStatus(estado: string): PipelineStatus {
    if (columns.some((col) => col.value === estado)) return estado as PipelineStatus;
    if (estado === "activo") return "cerrado";
    if (estado === "inactivo") return "pausado";
    if (estado === "potencial") return "prospecto";
    return "prospecto";
  }

  function onDrop(status: PipelineStatus) {
    if (!draggedClientId || !canEdit) return;
    updateStatusMut.mutate({ clientId: draggedClientId, estado: status });
    setDraggedClientId(null);
  }

  return (
    <AppShell title="Pipeline">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Pipeline de clientes</h2>
            <p className="text-sm text-muted-foreground">
              Seguimiento comercial desde prospecto hasta retainer activo.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/clients">Gestionar clientes</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por cliente o sector..."
              className="pl-9"
            />
          </div>
          <Select
            value={sector || ALL_FILTER_VALUE}
            onValueChange={(value) => setSector(value === ALL_FILTER_VALUE ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los sectores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>Todos los sectores</SelectItem>
              {sectors.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-3">
          {columns.map((column) => {
            const columnClients = filteredClients.filter(
              (client) => normalizedStatus(client.estado) === column.value,
            );
            return (
              <section
                key={column.value}
                className="min-h-[620px] rounded-md border bg-muted/30"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDrop(column.value)}
              >
                <div className="sticky top-0 z-[1] flex items-center justify-between border-b bg-background/95 px-3 py-2">
                  <h3 className="text-sm font-medium">{column.label}</h3>
                  <Badge variant="secondary">{columnClients.length}</Badge>
                </div>
                <div className="space-y-3 p-3">
                  {isLoading && <CardSkeleton />}
                  {!isLoading && columnClients.length === 0 && (
                    <div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
                      Sin clientes.
                    </div>
                  )}
                  {columnClients.map((client) => (
                    <PipelineCard
                      key={client.id}
                      client={client}
                      latestNote={latestNoteByClient.get(client.id)}
                      openInvoices={data?.openInvoicesByClient.get(client.id) ?? 0}
                      canEdit={canEdit}
                      onOpen={() => setSelectedClientId(client.id)}
                      onDragStart={() => setDraggedClientId(client.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClientId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedClient && (
            <ClientDrawer
              client={selectedClient}
              notes={notes.filter((note) => note.cliente_id === selectedClient.id)}
              canEdit={canEdit}
              onAddNote={(payload) => addNoteMut.mutate(payload)}
              isAddingNote={addNoteMut.isPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function PipelineCard({
  client,
  latestNote,
  openInvoices,
  canEdit,
  onOpen,
  onDragStart,
}: {
  client: Client;
  latestNote?: PipelineNote;
  openInvoices: number;
  canEdit: boolean;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  const lastActivity = latestNote?.fecha ?? client.updated_at;
  const days = daysSince(lastActivity);
  const needsAttention = activeAttentionStates.has(client.estado) && days > 14;
  const isStale = days > 7;

  return (
    <Card
      draggable={canEdit}
      onDragStart={onDragStart}
      className="cursor-pointer border bg-background transition-colors hover:bg-accent/50"
      onClick={onOpen}
    >
      <CardHeader className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-snug">
            {client.nombre_comercial || client.name}
          </CardTitle>
          {needsAttention && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
        </div>
        <div className="flex flex-wrap gap-1">
          {client.sector && <Badge variant="outline">{client.sector}</Badge>}
          {openInvoices > 0 && <Badge variant="secondary">{openInvoices} facturas</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Última actividad: hace {days} días
        </div>
        {latestNote && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{latestNote.nota}</p>
        )}
        {isStale && (
          <div className="rounded-sm bg-amber-50 px-2 py-1 text-xs text-amber-700">
            Revisar seguimiento
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClientDrawer({
  client,
  notes,
  canEdit,
  onAddNote,
  isAddingNote,
}: {
  client: Client;
  notes: PipelineNote[];
  canEdit: boolean;
  onAddNote: (payload: { clientId: string; tipo: string; nota: string }) => void;
  isAddingNote: boolean;
}) {
  const [tipo, setTipo] = useState("nota");
  const [nota, setNota] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = nota.trim();
    if (!clean) return toast.error("La nota no puede estar vacía");
    onAddNote({ clientId: client.id, tipo, nota: clean });
    setNota("");
    setTipo("nota");
  }

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>{client.nombre_comercial || client.name}</SheetTitle>
        <SheetDescription>{client.sector ?? "Sin sector"} · {client.estado}</SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Email" value={client.email ?? "—"} />
        <Info label="Teléfono" value={client.phone ?? "—"} />
        <Info label="Última actualización" value={formatDate(client.updated_at)} />
        <Info label="Creado" value={formatDate(client.created_at)} />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button asChild variant="outline">
          <Link to="/clients/$id" params={{ id: client.id }}>
            <UsersIconText text="Cliente" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/factu-nexa">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Facturas
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/dashboard">
            <FileText className="mr-2 h-4 w-4" /> Panel
          </Link>
        </Button>
      </div>

      {canEdit && (
        <form onSubmit={submit} className="space-y-3 rounded-md border p-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nota">Nota</SelectItem>
                <SelectItem value="llamada">Llamada</SelectItem>
                <SelectItem value="reunion">Reunión</SelectItem>
                <SelectItem value="propuesta">Propuesta</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nueva nota</Label>
            <Textarea
              value={nota}
              onChange={(event) => setNota(event.target.value)}
              placeholder="Añade contexto de la última interacción..."
            />
          </div>
          <Button type="submit" disabled={isAddingNote}>
            Añadir nota
          </Button>
        </form>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Historial de actividad</h3>
        {notes.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Sin notas todavía.
          </div>
        )}
        {notes.map((note) => (
          <div key={note.id} className="rounded-md border p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <Badge variant="secondary">{note.tipo}</Badge>
              <span className="text-xs text-muted-foreground">{formatDate(note.fecha)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{note.nota}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersIconText({ text }: { text: string }) {
  return <span>{text}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function CardSkeleton() {
  return <div className="h-24 animate-pulse rounded-md bg-muted" />;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function daysSince(value: string) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}
