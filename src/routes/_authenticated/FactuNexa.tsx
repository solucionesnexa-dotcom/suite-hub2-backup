import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Send, Download, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { parseCsv, parseAmount, parseDate } from "@/lib/csv";
import { generateSepaXml, validateRemittance, downloadXml, type SepaInvoiceInput } from "@/lib/sepa";

export const Route = createFileRoute("/_authenticated/factunexa")({
  ssr: false,
  head: () => ({ meta: [{ title: "FactuNexa · Nexa Suite" }] }),
  component: FactuNexaPage,
});

type Invoice = {
  id: string; client_id: string; mandate_id: string | null;
  invoice_number: string; issue_date: string; due_date: string;
  amount: number; currency: string; concept: string | null; status: string;
};

type ClientLite = { id: string; name: string; iban: string | null; bic: string | null };

function FactuNexaPage() {
  return (
    <AppShell title="FactuNexa">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">FactuNexa</h2>
          <p className="text-muted-foreground">Importa facturas y genera remesas SEPA pain.008.001.02.</p>
        </div>
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
            <TabsTrigger value="remittances">Generar remesa</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="remittances"><RemittanceTab /></TabsContent>
          <TabsContent value="history"><HistoryTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function useClients() {
  return useQuery({
    queryKey: ["clients-lite"],
    queryFn: async (): Promise<ClientLite[]> => {
      const { data, error } = await supabase.from("clients").select("id, name, iban, bic").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, client_id, mandate_id, invoice_number, issue_date, due_date, amount, currency, concept, status")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((i) => ({ ...i, amount: Number(i.amount) }));
    },
  });
}

function InvoicesTab() {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const { data: clients = [] } = useClients();
  const { data: invoices = [], isLoading } = useInvoices();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const createMut = useMutation({
    mutationFn: async (payload: Omit<Invoice, "id" | "status" | "currency"> & { status?: string }) => {
      if (!ws) throw new Error("Sin workspace");
      const { error } = await supabase.from("invoices").insert({
        workspace_id: ws.id,
        client_id: payload.client_id,
        invoice_number: payload.invoice_number,
        issue_date: payload.issue_date,
        due_date: payload.due_date,
        amount: payload.amount,
        concept: payload.concept,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Factura creada");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      if (!ws) throw new Error("Sin workspace");
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("CSV vacío");
      const byName = new Map(clients.map((c) => [c.name.toLowerCase(), c.id]));
      const toInsert: Array<{ workspace_id: string; client_id: string; invoice_number: string; amount: number; issue_date: string; due_date: string; concept: string | null; source: string; status: "pending"; }> = [];
      const errors: string[] = [];
      for (const [i, r] of rows.entries()) {
        const clientKey = (r.client || r.cliente || r.client_name || "").toLowerCase();
        const client_id = byName.get(clientKey);
        if (!client_id) {
          errors.push(`Fila ${i + 2}: cliente "${r.client || r.cliente}" no encontrado`);
          continue;
        }
        const amount = parseAmount(r.amount || r.importe || r.total || "");
        if (!isFinite(amount) || amount <= 0) {
          errors.push(`Fila ${i + 2}: importe inválido`);
          continue;
        }
        const invoice_number = r.invoice_number || r.numero || r.number || r.factura || "";
        if (!invoice_number) {
          errors.push(`Fila ${i + 2}: falta número`);
          continue;
        }
        const due_date = parseDate(r.due_date || r.vencimiento || "") || new Date().toISOString().slice(0, 10);
        const issue_date = parseDate(r.issue_date || r.fecha || "") || due_date;
        toInsert.push({ workspace_id: ws.id, client_id, invoice_number, amount, issue_date, due_date, concept: r.concept || r.concepto || null, source: "csv", status: "pending" });
      }
      if (!toInsert.length) throw new Error(errors[0] || "No se pudo importar ninguna fila");
      const { error } = await supabase.from("invoices").insert(toInsert);
      if (error) throw error;
      return { inserted: toInsert.length, errors };
    },
    onSuccess: (res) => {
      toast.success(`${res.inserted} facturas importadas`);
      if (res.errors.length) toast.warning(`${res.errors.length} filas omitidas`);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importPdfMut = useMutation({
    mutationFn: async (file: File) => {
      if (!ws) throw new Error("Sin workspace");
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${ws.id}/${ts}_${safeName}`;
      const { data, error } = await supabase.storage.from("factunexa").upload(path, file, { upsert: false });
      if (error) throw error;
      return { path, url: data.path };
    },
    onSuccess: (res) => {
      toast.success(`PDF subido: ${res.path}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    if (!isFinite(amount) || amount <= 0) return toast.error("Importe inválido");
    createMut.mutate({
      client_id: String(fd.get("client_id")),
      mandate_id: null,
      invoice_number: String(fd.get("invoice_number")),
      issue_date: String(fd.get("issue_date")),
      due_date: String(fd.get("due_date")),
      amount,
      concept: String(fd.get("concept") ?? "") || null,
    });
  }

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) importMut.mutate(f);
        e.currentTarget.value = "";
      }} />
      <input ref={pdfRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) importPdfMut.mutate(f);
        e.currentTarget.value = "";
      }} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
          <Upload className="w-4 h-4 mr-2" /> Importar CSV
        </Button>
        <Button variant="outline" onClick={() => pdfRef.current?.click()} disabled={importPdfMut.isPending}>
          <Upload className="w-4 h-4 mr-2" /> Importar PDF
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nueva factura</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label>Cliente *</Label>
                <Select name="client_id" required>
                  <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Número *</Label>
                <Input name="invoice_number" required />
              </div>
              <div className="grid gap-2">
                <Label>Importe (€) *</Label>
                <Input name="amount" type="number" step="0.01" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Emisión</Label>
                  <Input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="grid gap-2">
                  <Label>Vencimiento *</Label>
                  <Input name="due_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Concepto</Label>
                <Input name="concept" />
              </div>
              <DialogFooter><Button type="submit" disabled={createMut.isPending}>Guardar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Importe</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>}
            {!isLoading && invoices.length === 0 && <TableRow><TableCell colSpan={6}>Sin facturas. Crea una o importa un CSV.</TableCell></TableRow>}
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                <TableCell>{clientName(inv.client_id)}</TableCell>
                <TableCell>{inv.due_date}</TableCell>
                <TableCell>{inv.amount.toFixed(2)} €</TableCell>
                <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm("¿Eliminar factura?")) deleteMut.mutate(inv.id);
                  }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">CSV admite columnas: `client,invoice_number,amount,due_date,issue_date,concept` (también acepta nombres en español: cliente, numero, importe, vencimiento, fecha, concepto).</p>
    </div>
  );
}

function RemittanceTab() {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const { data: invoices = [] } = useInvoices();
  const { data: clients = [] } = useClients();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creditorName, setCreditorName] = useState("");
  const [creditorIban, setCreditorIban] = useState("");
  const [creditorBic, setCreditorBic] = useState("");
  const [creditorId, setCreditorId] = useState("");
  const [collectionDate, setCollectionDate] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  const [issues, setIssues] = useState<string[]>([]);

  const pending = invoices.filter((i) => i.status === "pending");

  const { data: mandatesByClient = new Map() } = useQuery({
    queryKey: ["all-mandates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sepa_mandates").select("*").eq("is_active", true);
      if (error) throw error;
      const map = new Map();
      for (const m of data ?? []) if (!map.has(m.client_id)) map.set(m.client_id, m);
      return map;
    },
  });

  const total = invoices.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.amount, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function buildInput() {
    const sepaInvoices: SepaInvoiceInput[] = [];
    for (const inv of invoices.filter((i) => selected.has(i.id))) {
      const client = clients.find((c) => c.id === inv.client_id);
      const mandate = mandatesByClient.get(inv.client_id);
      sepaInvoices.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        amount: inv.amount,
        concept: inv.concept,
        debtorName: client?.name ?? "",
        debtorIban: mandate?.iban ?? client?.iban ?? "",
        debtorBic: mandate?.bic ?? client?.bic ?? null,
        mandateReference: mandate?.mandate_reference ?? "",
        mandateSignatureDate: mandate?.signature_date ?? "",
        sequenceType: mandate?.sequence_type ?? "RCUR",
      });
    }
    const messageId = `NEXA-${Date.now()}`;
    return { messageId, creditorName, creditorIban, creditorBic: creditorBic || null, creditorId, collectionDate, invoices: sepaInvoices };
  }

  const generateMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      const input = buildInput();
      const found = validateRemittance(input);
      if (found.length) {
        setIssues(found.map((f) => f.message));
        throw new Error("Validación fallida");
      }
      setIssues([]);
      const xml = generateSepaXml(input);
      const { data: rem, error } = await supabase.from("remittances").insert({
        workspace_id: ws.id,
        message_id: input.messageId,
        creditor_name: input.creditorName,
        creditor_iban: input.creditorIban.replace(/\s+/g, "").toUpperCase(),
        creditor_bic: input.creditorBic,
        creditor_id: input.creditorId,
        collection_date: input.collectionDate,
        total_amount: input.invoices.reduce((s, i) => s + i.amount, 0),
        transaction_count: input.invoices.length,
        xml_content: xml,
        status: "generated",
      }).select().single();
      if (error) throw error;
      await supabase.from("remittance_invoices").insert(input.invoices.map((i) => ({ remittance_id: rem.id, invoice_id: i.invoiceId, amount: i.amount })));
      await supabase.from("invoices").update({ status: "included" }).in("id", input.invoices.map((i) => i.invoiceId));
      downloadXml(`${input.messageId}.xml`, xml);
      return rem;
    },
    onSuccess: () => {
      toast.success("Remesa generada y descargada");
      setSelected(new Set());
      setIssues([]);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["remittances"] });
    },
    onError: (e: Error) => {
      if (e.message !== "Validación fallida") toast.error(e.message);
    },
  });

  function preview() {
    const found = validateRemittance(buildInput());
    setIssues(found.map((f) => f.message));
    if (!found.length) toast.success("Validación OK. Lista para generar.");
    else toast.error(`${found.length} problemas encontrados`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Selecciona facturas a incluir</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 && <p className="text-muted-foreground">Sin facturas pendientes.</p>}
          {pending.map((inv) => {
            const m = mandatesByClient.get(inv.client_id);
            return (
              <div key={inv.id} className="flex items-center gap-3 p-2 border rounded">
                <Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggle(inv.id)} />
                <div>
                  <div className="font-medium">{inv.invoice_number}</div>
                  <div className="text-sm text-muted-foreground">{clients.find((c) => c.id === inv.client_id)?.name}</div>
                </div>
                <div className="ml-auto text-sm">
                  {m ? <Badge variant="secondary">{m.mandate_reference}</Badge> : <Badge variant="destructive">sin mandato</Badge>}
                </div>
                <div className="font-mono">{inv.amount.toFixed(2)} €</div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Datos del acreedor</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={creditorName} onChange={(e) => setCreditorName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>IBAN</Label>
              <Input value={creditorIban} onChange={(e) => setCreditorIban(e.target.value)} className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label>BIC (opcional)</Label>
              <Input value={creditorBic} onChange={(e) => setCreditorBic(e.target.value)} className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label>Identificador acreedor (Creditor ID)</Label>
              <Input value={creditorId} onChange={(e) => setCreditorId(e.target.value)} placeholder="ESxxZZZxxxxxxxxx" />
            </div>
            <div className="grid gap-2">
              <Label>Fecha de cobro</Label>
              <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between">
                <span className="font-medium">Operaciones</span>
                <span>{selected.size}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{total.toFixed(2)} €</span>
              </div>
              {issues.length > 0 && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded">
                  <p className="font-bold mb-1">Errores de validación</p>
                  {issues.slice(0, 8).map((m, i) => <div key={i}>• {m}</div>)}
                  {issues.length > 8 && <div>… y {issues.length - 8} más</div>}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={preview}>Validar</Button>
                <Button onClick={() => generateMut.mutate()} disabled={selected.size === 0 || generateMut.isPending} className="flex-1">Generar XML</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HistoryTab() {
  const { data: remittances = [], isLoading } = useQuery({
    queryKey: ["remittances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("remittances").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Message ID</TableHead>
            <TableHead>Fecha cobro</TableHead>
            <TableHead>Operaciones</TableHead>
            <TableHead>Importe</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>}
          {!isLoading && remittances.length === 0 && <TableRow><TableCell colSpan={6}>Aún no hay remesas.</TableCell></TableRow>}
          {remittances.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.message_id}</TableCell>
              <TableCell>{r.collection_date}</TableCell>
              <TableCell>{r.transaction_count}</TableCell>
              <TableCell>{Number(r.total_amount).toFixed(2)} €</TableCell>
              <TableCell><Badge>{r.status}</Badge></TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => downloadXml(`${r.message_id}.xml`, r.xml_content)}>
                  <Download className="w-3 h-3 mr-2" /> XML
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
