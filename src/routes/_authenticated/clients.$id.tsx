import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { isValidIban, formatIban } from "@/lib/iban";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cliente · Nexa Suite" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = useParams({ from: "/_authenticated/clients/$id" });
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const [mandateOpen, setMandateOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: mandates = [] } = useQuery({
    queryKey: ["mandates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sepa_mandates")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contactos")
        .select("*")
        .eq("client_id", id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["client-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount, due_date, status")
        .eq("client_id", id)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((i) => ({ ...i, amount: Number(i.amount) }));
    },
  });

  const createMandate = useMutation({
    mutationFn: async (m: { mandate_reference: string; iban: string; bic: string | null; debtor_name: string; signature_date: string }) => {
      if (!ws) throw new Error("Sin workspace");
      const { error } = await supabase.from("sepa_mandates").insert({
        workspace_id: ws.id,
        client_id: id,
        mandate_reference: m.mandate_reference,
        iban: m.iban.replace(/\s+/g, "").toUpperCase(),
        bic: m.bic,
        debtor_name: m.debtor_name,
        signature_date: m.signature_date,
        sequence_type: "RCUR",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mandato creado");
      qc.invalidateQueries({ queryKey: ["mandates", id] });
      setMandateOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMandate = useMutation({
    mutationFn: async (mid: string) => {
      const { error } = await supabase.from("sepa_mandates").delete().eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mandates", id] }),
  });

  const createContact = useMutation({
    mutationFn: async (c: { nombre: string; email?: string; telefono?: string; cargo?: string; notas?: string }) => {
      if (!ws) throw new Error("Sin workspace");
      const { error } = await supabase.from("contactos").insert({
        workspace_id: ws.id,
        client_id: id,
        nombre: c.nombre,
        email: c.email || null,
        telefono: c.telefono || null,
        cargo: c.cargo || null,
        notas: c.notas || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contacto añadido");
      qc.invalidateQueries({ queryKey: ["contacts", id] });
      setContactOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteContact = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase.from("contactos").delete().eq("id", cid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts", id] }),
  });

  const updateClient = useMutation({
    mutationFn: async (data: Partial<typeof client>) => {
      const { error } = await supabase.from("clients").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente actualizado");
      qc.invalidateQueries({ queryKey: ["client", id] });
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onMandateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const iban = String(fd.get("iban") ?? "");
    if (!isValidIban(iban)) return toast.error("IBAN no válido");
    createMandate.mutate({
      mandate_reference: String(fd.get("mandate_reference") ?? ""),
      iban,
      bic: String(fd.get("bic") ?? "").trim() || null,
      debtor_name: String(fd.get("debtor_name") ?? "") || client?.name || "",
      signature_date: String(fd.get("signature_date") ?? ""),
    });
  }

  function onContactSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nombre = String(fd.get("nombre") ?? "").trim();
    if (!nombre) return toast.error("El nombre es obligatorio");
    createContact.mutate({
      nombre,
      email: String(fd.get("email") ?? "").trim() || undefined,
      telefono: String(fd.get("telefono") ?? "").trim() || undefined,
      cargo: String(fd.get("cargo") ?? "").trim() || undefined,
      notas: String(fd.get("notas") ?? "").trim() || undefined,
    });
  }

  function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateClient.mutate({
      name: String(fd.get("name") ?? ""),
      tax_id: String(fd.get("tax_id") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim() || null,
      phone: String(fd.get("phone") ?? "").trim() || null,
      iban: String(fd.get("iban") ?? "").trim().replace(/\s+/g, "").toUpperCase() || null,
      bic: String(fd.get("bic") ?? "").trim() || null,
      sector: String(fd.get("sector") ?? "").trim() || null,
      estado: String(fd.get("estado") ?? ""),
    });
  }

  const activeMandate = mandates.find((m) => m.is_active);

  return (
    <AppShell title={client?.name ?? "Cliente"}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link to="/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" /> Volver a clientes
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Datos generales</CardTitle>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Edit2 className="mr-2 h-4 w-4" /> Editar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
                <form onSubmit={onEditSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input id="name" name="name" required defaultValue={client?.name} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>NIF/CIF</Label><Input name="tax_id" defaultValue={client?.tax_id || ""} /></div>
                    <div className="space-y-1.5"><Label>Teléfono</Label><Input name="phone" defaultValue={client?.phone || ""} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Estado</Label><Input name="estado" defaultValue={client?.estado || "activo"} /></div>
                    <div className="space-y-1.5"><Label>Sector</Label><Input name="sector" defaultValue={client?.sector || ""} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" defaultValue={client?.email || ""} /></div>
                  <div className="space-y-1.5"><Label>IBAN</Label><Input name="iban" defaultValue={client?.iban || ""} className="font-mono" /></div>
                  <div className="space-y-1.5"><Label>BIC</Label><Input name="bic" defaultValue={client?.bic || ""} className="font-mono" /></div>
                  <DialogFooter><Button type="submit" disabled={updateClient.isPending}>Guardar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><div className="text-xs text-muted-foreground">Nombre</div><div className="font-medium">{client?.name}</div></div>
            <div><div className="text-xs text-muted-foreground">NIF</div><div>{client?.tax_id ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Email</div><div>{client?.email ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Teléfono</div><div>{client?.phone ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Sector</div><div>{client?.sector ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Estado</div><div><Badge variant={client?.estado === "activo" ? "default" : "secondary"}>{client?.estado}</Badge></div></div>
            <div className="sm:col-span-2"><div className="text-xs text-muted-foreground">IBAN</div><div className="font-mono">{client?.iban ? formatIban(client.iban) : "—"}</div></div>
            <div className="sm:col-span-2"><div className="text-xs text-muted-foreground">BIC</div><div className="font-mono">{client?.bic ?? "—"}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contactos asociados</CardTitle>
            <Dialog open={contactOpen} onOpenChange={setContactOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Nuevo contacto</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo contacto</DialogTitle></DialogHeader>
                <form onSubmit={onContactSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input id="nombre" name="nombre" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" /></div>
                    <div className="space-y-1.5"><Label>Teléfono</Label><Input name="telefono" /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Cargo</Label><Input name="cargo" placeholder="Responsable de compras" /></div>
                  <div className="space-y-1.5"><Label>Notas</Label><Textarea name="notas" rows={2} /></div>
                  <DialogFooter><Button type="submit" disabled={createContact.isPending}>Guardar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">Sin contactos.</TableCell></TableRow>
                )}
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-sm">{c.telefono ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.cargo ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar?")) deleteContact.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mandato SEPA {activeMandate && <Badge className="ml-2">Activo</Badge>}</CardTitle>
            <Dialog open={mandateOpen} onOpenChange={setMandateOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Nuevo mandato</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo mandato SEPA</DialogTitle></DialogHeader>
                <form onSubmit={onMandateSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mandate_reference">Referencia mandato *</Label>
                    <Input id="mandate_reference" name="mandate_reference" required maxLength={35} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="debtor_name">Nombre del deudor</Label>
                    <Input id="debtor_name" name="debtor_name" defaultValue={client?.name ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="iban">IBAN *</Label>
                    <Input id="iban" name="iban" required defaultValue={client?.iban ?? ""} className="font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="bic">BIC</Label>
                      <Input id="bic" name="bic" defaultValue={client?.bic ?? ""} className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signature_date">Fecha firma *</Label>
                      <Input id="signature_date" name="signature_date" type="date" required />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={createMandate.isPending}>Guardar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandates.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">Sin mandatos.</TableCell></TableRow>
                )}
                {mandates.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.mandate_reference}</TableCell>
                    <TableCell className="font-mono text-xs">{formatIban(m.iban)}</TableCell>
                    <TableCell>{m.signature_date}</TableCell>
                    <TableCell>{m.sequence_type}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar mandato?")) deleteMandate.mutate(m.id); }}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Facturas externas vinculadas</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">Sin facturas.</TableCell></TableRow>
                )}
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.due_date}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{inv.amount.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          inv.status === "paid" ? "default" : 
                          inv.status === "included" ? "secondary" :
                          inv.status === "pending" ? "outline" :
                          "destructive"
                        }
                      >
                        {inv.status === "pending" ? "Pendiente" : inv.status === "included" ? "Remesada" : inv.status === "paid" ? "Cobrada" : inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
