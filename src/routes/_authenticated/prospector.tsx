import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useCanEdit } from "@/hooks/useCanEdit";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { searchGoogleMapsLeads, type GoogleMapsLead } from "@/lib/api/prospector.functions";
import { db } from "@/lib/nexa";
import { Building2, ExternalLink, Filter, Lightbulb, MapPin, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/prospector")({
  ssr: false,
  head: () => ({ meta: [{ title: "Prospector · Nexa Suite" }] }),
  component: ProspectorPage,
});

const statuses = ["nuevo", "contactado", "cualificado", "descartado", "convertido"];

const sociosanitarioCategories = [
  "residencias de mayores",
  "centros de dia para mayores",
  "empresa ayuda a domicilio",
  "servicio de ayuda a domicilio SAD",
  "teleasistencia",
  "centro sociosanitario",
  "geriatrico",
  "viviendas tuteladas mayores",
  "El Roble Solidario sca",
];

function ProspectorPage() {
  const { data: ws } = useCurrentWorkspace();
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const [status, setStatus] = useState("todos");
  const [query, setQuery] = useState("");
  const [mapsQuery, setMapsQuery] = useState("residencias de mayores");
  const [mapsLocation, setMapsLocation] = useState("Andalucia");
  const [mapsResults, setMapsResults] = useState<GoogleMapsLead[]>([]);
  const [form, setForm] = useState(emptyForm());

  const score = useMemo(() => scoreLead(form), [form]);

  const { data: leads = [] } = useQuery({
    queryKey: ["prospector-leads", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db
        .from("prospector_leads")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("score", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mapsSearchMut = useMutation({
    mutationFn: async () =>
      searchGoogleMapsLeads({ data: { query: mapsQuery, location: mapsLocation, maxResults: 12 } }),
    onSuccess: (results) => {
      setMapsResults(results);
      toast.success(`${results.length} resultados encontrados`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      if (!form.nombre_comercial.trim()) throw new Error("El nombre comercial es obligatorio");
      const { error } = await db.from("prospector_leads").insert({
        workspace_id: ws.id,
        ...form,
        score,
        creado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospector-leads"] });
      setForm(emptyForm());
      toast.success("Lead guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMapsMut = useMutation({
    mutationFn: async (place: GoogleMapsLead) => {
      if (!ws) throw new Error("Sin workspace");
      const payload = leadFromPlace(place, mapsQuery, mapsLocation);
      const { error } = await db.from("prospector_leads").insert({
        workspace_id: ws.id,
        ...payload,
        score: scoreLead(payload),
        creado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospector-leads"] });
      toast.success("Lead importado desde Google Maps");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { error } = await db.from("prospector_leads").update({ estado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospector-leads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMut = useMutation({
    mutationFn: async (lead: any) => {
      if (!ws) throw new Error("Sin workspace");
      const { data: client, error } = await db
        .from("clients")
        .insert({
          workspace_id: ws.id,
          name: lead.nombre_comercial,
          sector: lead.sector,
          website: lead.web,
          email: lead.email,
          phone: lead.telefono,
          address: lead.direccion,
          notes: [lead.necesidad_detectada, lead.google_maps_url].filter(Boolean).join("\n"),
          status: "prospecto",
          last_contact_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: leadError } = await db
        .from("prospector_leads")
        .update({ estado: "convertido", client_id: client.id })
        .eq("id", lead.id);
      if (leadError) throw leadError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospector-leads"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["pipeline-clients"] });
      toast.success("Lead convertido en cliente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const analyzeMut = useMutation({
    mutationFn: async (lead: any) => {
      const analysis = analyzeOpportunity(lead);
      const { error } = await db
        .from("prospector_leads")
        .update({
          oportunidad_score: analysis.score,
          oportunidad_analisis: analysis,
          propuesta_comercial: analysis.propuesta,
          estado: lead.estado === "nuevo" ? "cualificado" : lead.estado,
        })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospector-leads"] });
      toast.success("Oportunidad analizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = leads.filter((lead: any) => {
    const matchesStatus = status === "todos" || lead.estado === status;
    const text = `${lead.nombre_comercial} ${lead.sector ?? ""} ${lead.localidad ?? ""}`.toLowerCase();
    return matchesStatus && text.includes(query.toLowerCase());
  });

  return (
    <AppShell title="Prospector">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[430px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Busqueda Google Maps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Categoria sociosanitaria</Label>
                <Select value={mapsQuery} onValueChange={setMapsQuery}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sociosanitarioCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Busqueda libre">
                <Input value={mapsQuery} onChange={(e) => setMapsQuery(e.target.value)} />
              </Field>
              <Field label="Zona">
                <Input value={mapsLocation} onChange={(e) => setMapsLocation(e.target.value)} placeholder="Sevilla, Malaga, Andalucia..." />
              </Field>
              <Button onClick={() => mapsSearchMut.mutate()} disabled={!canEdit || mapsSearchMut.isPending}>
                <Search className="mr-2 h-4 w-4" /> Buscar empresas
              </Button>
              <p className="text-xs text-muted-foreground">
                Usa Google Places Text Search desde servidor. Requiere `GOOGLE_MAPS_API_KEY`.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nuevo lead manual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Nombre comercial">
                <Input value={form.nombre_comercial} onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sector"><Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></Field>
                <Field label="Localidad"><Input value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} /></Field>
              </div>
              <Field label="Web"><Input value={form.web} onChange={(e) => setForm({ ...form, web: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Telefono"><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
              </div>
              <Field label="Necesidad detectada">
                <Textarea value={form.necesidad_detectada} onChange={(e) => setForm({ ...form, necesidad_detectada: e.target.value })} />
              </Field>
              <Field label="Notas">
                <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </Field>
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Score automatico</span>
                  <strong>{score}/100</strong>
                </div>
                <Progress value={score} />
              </div>
              <Button onClick={() => createMut.mutate()} disabled={!canEdit || createMut.isPending}>
                <Plus className="mr-2 h-4 w-4" /> Guardar lead
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resultados de Google Maps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mapsResults.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Busca por categoria y zona para importar residencias, centros de dia o empresas de ayuda a domicilio.
                </p>
              )}
              {mapsResults.map((place) => (
                <div key={place.placeId} className="grid gap-3 rounded-md border p-3 lg:grid-cols-[1fr_120px_140px]">
                  <div>
                    <div className="font-medium">{place.name}</div>
                    <div className="text-sm text-muted-foreground">{place.address ?? "Sin direccion"}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {place.phone && <span>{place.phone}</span>}
                      {place.website && <a className="text-primary hover:underline" href={place.website} target="_blank" rel="noreferrer">web</a>}
                      {place.googleMapsUri && (
                        <a className="text-primary hover:underline" href={place.googleMapsUri} target="_blank" rel="noreferrer">
                          Maps <ExternalLink className="inline h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <Badge variant="secondary">
                      {place.rating ? `${place.rating} · ${place.userRatingCount ?? 0}` : "Sin rating"}
                    </Badge>
                  </div>
                  <Button variant="outline" disabled={!canEdit} onClick={() => importMapsMut.mutate(place)}>
                    <Plus className="mr-2 h-4 w-4" /> Importar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap gap-3 p-4">
              <div className="relative min-w-[220px] flex-1">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar lead..." className="pl-9" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[190px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads priorizados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filtered.length === 0 && <p className="text-sm text-muted-foreground">Sin leads en esta vista.</p>}
              {filtered.map((lead: any) => (
                <div key={lead.id} className="rounded-md border p-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_120px_170px_150px]">
                  <div>
                    <div className="font-medium">{lead.nombre_comercial}</div>
                    <div className="text-sm text-muted-foreground">
                      {[lead.sector, lead.localidad, lead.fuente].filter(Boolean).join(" · ")}
                    </div>
                    {lead.direccion && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {lead.direccion}
                      </div>
                    )}
                    {lead.necesidad_detectada && <div className="mt-2 text-sm">{lead.necesidad_detectada}</div>}
                  </div>
                  <div>
                    <Badge variant={lead.oportunidad_score >= 70 ? "default" : lead.score >= 40 ? "secondary" : "outline"}>
                      Oportunidad {lead.oportunidad_score || lead.score}/100
                    </Badge>
                  </div>
                  <Select value={lead.estado} disabled={!canEdit} onValueChange={(estado) => updateStatusMut.mutate({ id: lead.id, estado })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!canEdit || lead.estado === "convertido"}
                    onClick={() => convertMut.mutate(lead)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" /> Convertir
                  </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" disabled={!canEdit} onClick={() => analyzeMut.mutate(lead)}>
                      <Lightbulb className="mr-2 h-4 w-4" /> Analizar oportunidad
                    </Button>
                    {lead.propuesta_comercial && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(lead.propuesta_comercial)}
                      >
                        Copiar propuesta
                      </Button>
                    )}
                  </div>
                  {lead.oportunidad_analisis?.resumen && (
                    <div className="mt-3 grid gap-3 rounded-md bg-muted/40 p-3 text-sm lg:grid-cols-2">
                      <div>
                        <div className="font-medium">Oportunidad para Nexa</div>
                        <p className="mt-1 text-muted-foreground">{lead.oportunidad_analisis.resumen}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(lead.oportunidad_analisis.servicios ?? []).map((service: string) => (
                            <Badge key={service} variant="outline">{service}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Propuesta inicial</div>
                        <p className="mt-1 whitespace-pre-line text-muted-foreground">{lead.propuesta_comercial}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function analyzeOpportunity(lead: any) {
  const sectorText = `${lead.sector ?? ""} ${lead.necesidad_detectada ?? ""} ${lead.notas ?? ""}`.toLowerCase();
  const isSociosanitario =
    sectorText.includes("sociosanitario") ||
    sectorText.includes("residencia") ||
    sectorText.includes("mayores") ||
    sectorText.includes("centro de dia") ||
    sectorText.includes("ayuda a domicilio") ||
    sectorText.includes("sad");

  const servicios = isSociosanitario
    ? [
        "Diagnostico digital",
        "Automatizacion de admisiones",
        "Comunicacion con familias",
        "SOP operativos",
        "ROI Calculator",
      ]
    : ["Diagnostico digital", "Auditoria de procesos", "Automatizacion basica", "Presupuesto comercial"];

  const pains = isSociosanitario
    ? [
        "gestion manual de solicitudes de plaza o altas",
        "seguimiento disperso de citas, familias y documentacion",
        "comunicaciones repetitivas por telefono o WhatsApp",
        "procesos internos dificiles de medir entre centro, administracion y equipo asistencial",
      ]
    : [
        "tareas administrativas repetitivas",
        "seguimiento comercial poco centralizado",
        "informacion repartida entre hojas de calculo, correo y mensajeria",
      ];

  const base = Number(lead.score ?? 0);
  const mapsBoost = lead.fuente === "google_maps" ? 10 : 0;
  const sectorBoost = isSociosanitario ? 20 : 5;
  const contactBoost = lead.telefono || lead.email || lead.web ? 10 : 0;
  const reputationBoost = Number(lead.reviews_count ?? 0) >= 20 || Number(lead.rating ?? 0) >= 4 ? 10 : 0;
  const score = Math.min(100, Math.round(base * 0.45 + mapsBoost + sectorBoost + contactBoost + reputationBoost + 20));

  const resumen = isSociosanitario
    ? `${lead.nombre_comercial} encaja con una oportunidad sociosanitaria: entidades con residencias, centros de dia o servicios SAD suelen tener carga administrativa, coordinacion con familias y documentacion operativa recurrente.`
    : `${lead.nombre_comercial} puede encajar con una auditoria de procesos para detectar automatizaciones rapidas y preparar una propuesta de mejora.`;

  const propuesta = `Hola, equipo de ${lead.nombre_comercial}.

Soy Nexa Soluciones. Ayudamos a pymes y entidades de servicios a reducir trabajo administrativo con automatizaciones sencillas, documentacion SOP y cuadros de seguimiento.

Por vuestro tipo de actividad, vemos una oportunidad clara en ${pains.slice(0, 2).join(" y ")}. La propuesta inicial seria hacer un Diagnostico Digital Express para identificar 3 mejoras concretas, estimar ahorro con una calculadora ROI y, si encaja, preparar una implantacion por fases.

Podemos empezar con una sesion breve de 30 minutos y devolveros un one-pager con quick wins y una propuesta cerrada.`;

  return {
    score,
    resumen,
    pains,
    servicios,
    siguiente_paso: "Contactar para diagnostico express de 30 minutos",
    propuesta,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function emptyForm() {
  return {
    nombre_comercial: "",
    sector: "Sociosanitario",
    web: "",
    email: "",
    telefono: "",
    localidad: "",
    direccion: "",
    google_place_id: "",
    google_maps_url: "",
    rating: null as number | null,
    reviews_count: null as number | null,
    fuente: "manual",
    necesidad_detectada: "",
    notas: "",
  };
}

function leadFromPlace(place: GoogleMapsLead, category: string, location: string) {
  return {
    nombre_comercial: place.name,
    sector: "Sociosanitario",
    web: place.website ?? "",
    email: "",
    telefono: place.phone ?? "",
    localidad: location,
    direccion: place.address ?? "",
    google_place_id: place.placeId,
    google_maps_url: place.googleMapsUri ?? "",
    rating: place.rating,
    reviews_count: place.userRatingCount,
    fuente: "google_maps",
    necesidad_detectada: `Prospecto sociosanitario encontrado por categoria "${category}". Posible encaje: automatizacion de admisiones, agenda, comunicacion con familias, facturacion o documentacion operativa.`,
    notas: place.primaryType ? `Tipo Google: ${place.primaryType}. Tags: ${place.types.join(", ")}` : "",
  };
}

function scoreLead(lead: {
  sector: string;
  web: string;
  email: string;
  telefono: string;
  fuente: string;
  necesidad_detectada: string;
  rating?: number | null;
  reviews_count?: number | null;
}) {
  let score = 20;
  if (lead.sector.toLowerCase().includes("sociosanitario")) score += 15;
  if (lead.web.trim()) score += 10;
  if (lead.email.trim()) score += 10;
  if (lead.telefono.trim()) score += 10;
  if (lead.fuente === "google_maps") score += 10;
  if ((lead.rating ?? 0) >= 4) score += 10;
  if ((lead.reviews_count ?? 0) >= 20) score += 10;
  if (lead.necesidad_detectada.trim().length > 30) score += 15;
  return Math.min(100, score);
}
