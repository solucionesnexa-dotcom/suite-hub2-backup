import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
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
import { PdfImportDialog } from "@/components/PdfImportDialog";


export const Route = createFileRoute("/_authenticated/digifactu")({
  ssr: false,
  head: () => ({ meta: [{ title: "Digifactu · Nexa Suite" }] }),
  component: DigifactuPage,
});

type Invoice = {
  id: string; client_id: string; mandate_id: string | null;
  invoice_number: string; issue_date: string; due_date: string;
  amount: number; currency: string; concept: string | null; status: string;
};
type ClientLite = { id: string; name: string; iban: string | null; bic: string | null };

function DigifactuPage() {
  return (
    <AppShell title="Digifactu">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Digifactu</h2>
          <p className="text-sm text-muted-foreground">Importa facturas y genera remesas SEPA pain.008.001.02.</p>
        </div>
        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
            <TabsTrigger value="remit">Generar remesa</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="remit"><RemittanceTab /></TabsContent>
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

  const createMut = useMutation({
    mutationFn: async (payload: Omit<Invoice, "id" | "currency" | "status"> & { status?: string }) => {
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
    onSuccess: () => { toast.success("Factura creada"); qc.invalidateQueries({ queryKey: ["invoices"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("invoices").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      if (!ws) throw new Error("Sin workspace");
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("CSV vacío");
      const byName = new Map(clients.map((c) => [c.name.toLowerCase(), c.id]));
      const toInsert: Array<{
        workspace_id: string; client_id: string; invoice_number: string;
        amount: number; issue_date: string; due_date: string;
        concept: string | null; source: string; status: "pending";
      }> = [];
      const errors: string[] = [];
      for (const [i, r] of rows.entries()) {
        const clientKey = (r.client || r.cliente || r.client_name || "").toLowerCase();
        const client_id = byName.get(clientKey);
        if (!client_id) { errors.push(`Fila ${i + 2}: cliente "${r.client || r.cliente}" no encontrado`); continue; }
        const amount = parseAmount(r.amount || r.importe || r.total || "");
        if (!isFinite(amount) || amount <= 0) { errors.push(`Fila ${i + 2}: importe inválido`); continue; }
        const invoice_number = r.invoice_number || r.numero || r.number || r.factura || "";
        if (!invoice_number) { errors.push(`Fila ${i + 2}: falta número`); continue; }
        const due_date = parseDate(r.due_date || r.vencimiento || "") || new Date().toISOString().slice(0, 10);
        const issue_date = parseDate(r.issue_date || r.fecha || "") || due_date;
        toInsert.push({
          workspace_id: ws.id, client_id, invoice_number, amount,
          issue_date, due_date,
          concept: r.concept || r.concepto || null,
          source: "csv", status: "pending",
        });
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.currentTarget.value = ""; }} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
          <Upload className="mr-2 h-4 w-4" /> Importar CSV
        </Button>
        <PdfImportDialog workspaceId={ws?.id} clients={clients} />
        <Dialog open={open} onOpenChange={setOpen}>

          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nueva factura</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select name="client_id" required>
                  <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Número *</Label><Input name="invoice_number" required /></div>
                <div className="space-y-1.5"><Label>Importe (€) *</Label><Input name="amount" type="number" step="0.01" required /></div>
                <div className="space-y-1.5"><Label>Emisión</Label><Input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
                <div className="space-y-1.5"><Label>Vencimiento *</Label><Input name="due_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Concepto</Label><Input name="concept" /></div>
              <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead><TableHead>Cliente</TableHead>
                <TableHead>Vencimiento</TableHead><TableHead className="text-right">Importe</TableHead>
                <TableHead>Estado</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Cargando...</TableCell></TableRow>}
              {!isLoading && invoices.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Sin facturas. Crea una o importa un CSV.</TableCell></TableRow>}
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                  <TableCell>{clientName(inv.client_id)}</TableCell>
                  <TableCell>{inv.due_date}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{inv.amount.toFixed(2)} €</TableCell>
                  <TableCell><Badge variant={inv.status === "paid" ? "default" : inv.status === "included" ? "secondary" : "outline"}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar factura?")) deleteMut.mutate(inv.id); }}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">CSV admite columnas: <code>client,invoice_number,amount,due_date,issue_date,concept</code> (también acepta nombres en español: cliente, numero, importe, vencimiento, fecha, concepto).</p>
    </div>
  );
}

function RemittanceTab() {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const { data: invoices = [] } = useInvoices();
  const { data: clients = [] } = useClients();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [creditorName, setCreditorName] = useState("");
  const [creditorIban, setCreditorIban] = useState("");
  const [creditorBic, setCreditorBic] = useState("");
  const [creditorId, setCreditorId] = useState("");
  const [collectionDate, setCollectionDate] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  const [issues, setIssues] = useState<string[]>([]);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["company-bank-accounts", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_bank_accounts")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!bankAccountId && bankAccounts.length) {
      const def = bankAccounts.find((b) => b.is_default) ?? bankAccounts[0];
      setBankAccountId(def.id);
      setCreditorName(def.sepa_creditor_name);
      setCreditorIban(def.iban);
      setCreditorBic(def.bic ?? "");
      setCreditorId(def.sepa_creditor_id);
    }
  }, [bankAccounts, bankAccountId]);

  function onBankChange(id: string) {
    setBankAccountId(id);
    const b = bankAccounts.find((x) => x.id === id);
    if (b) {
      setCreditorName(b.sepa_creditor_name);
      setCreditorIban(b.iban);
      setCreditorBic(b.bic ?? "");
      setCreditorId(b.sepa_creditor_id);
    }
  }

  const pending = invoices.filter((i) => i.status === "pending");

  // Load mandates for selected invoices' clients
  const { data: mandatesByClient = new Map<string, any>() } = useQuery({
    queryKey: ["all-mandates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sepa_mandates").select("*").eq("is_active", true);
      if (error) throw error;
      const map = new Map<string, any>();
      for (const m of data ?? []) if (!map.has(m.client_id)) map.set(m.client_id, m);
      return map;
    },
  });

  const total = invoices.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.amount, 0);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
    return {
      messageId, creditorName, creditorIban, creditorBic: creditorBic || null,
      creditorId, collectionDate, invoices: sepaInvoices,
    };
  }

  const generateMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      const input = buildInput();
      const found = validateRemittance(input);
      if (found.length) { setIssues(found.map((f) => f.message)); throw new Error("Validación fallida"); }
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
        company_bank_account_id: bankAccountId || null,
      }).select().single();
      if (error) throw error;
      await supabase.from("remittance_invoices").insert(input.invoices.map((i) => ({
        remittance_id: rem.id, invoice_id: i.invoiceId, amount: i.amount,
      })));
      await supabase.from("invoices").update({ status: "included" }).in("id", input.invoices.map((i) => i.invoiceId));
      downloadXml(`${input.messageId}.xml`, xml);
      return rem;
    },
    onSuccess: () => {
      toast.success("Remesa generada y descargada");
      setSelected(new Set()); setIssues([]);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["remittances"] });
    },
    onError: (e: Error) => { if (e.message !== "Validación fallida") toast.error(e.message); },
  });

  function preview() {
    const found = validateRemittance(buildInput());
    setIssues(found.map((f) => f.message));
    if (!found.length) toast.success("Validación OK. Lista para generar.");
    else toast.error(`${found.length} problemas encontrados`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Selecciona facturas a incluir</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Número</TableHead><TableHead>Cliente</TableHead>
                <TableHead>Mandato</TableHead><TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">Sin facturas pendientes.</TableCell></TableRow>}
              {pending.map((inv) => {
                const m = mandatesByClient.get(inv.client_id);
                return (
                  <TableRow key={inv.id}>
                    <TableCell><Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggle(inv.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell>{clients.find((c) => c.id === inv.client_id)?.name}</TableCell>
                    <TableCell className="text-xs">{m ? <span className="text-foreground font-mono">{m.mandate_reference}</span> : <span className="text-destructive">sin mandato</span>}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{inv.amount.toFixed(2)} €</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Datos del acreedor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={creditorName} onChange={(e) => setCreditorName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>IBAN</Label><Input value={creditorIban} onChange={(e) => setCreditorIban(e.target.value)} className="font-mono" /></div>
          <div className="space-y-1.5"><Label>BIC (opcional)</Label><Input value={creditorBic} onChange={(e) => setCreditorBic(e.target.value)} className="font-mono" /></div>
          <div className="space-y-1.5"><Label>Identificador acreedor (Creditor ID)</Label><Input value={creditorId} onChange={(e) => setCreditorId(e.target.value)} placeholder="ESxxZZZxxxxxxxxx" /></div>
          <div className="space-y-1.5"><Label>Fecha de cobro</Label><Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} /></div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Operaciones</span><span className="font-mono tabular-nums">{selected.size}</span></div>
            <div className="flex justify-between font-medium"><span>Total</span><span className="font-mono tabular-nums">{total.toFixed(2)} €</span></div>
          </div>

          {issues.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <div className="mb-1 flex items-center gap-1 font-medium text-destructive"><AlertTriangle className="h-3 w-3" /> Errores de validación</div>
              <ul className="list-disc pl-4 space-y-0.5 text-destructive">
                {issues.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}
                {issues.length > 8 && <li>… y {issues.length - 8} más</li>}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={preview} disabled={selected.size === 0} className="flex-1">Validar</Button>
            <Button onClick={() => generateMut.mutate()} disabled={selected.size === 0 || generateMut.isPending} className="flex-1">
              <Send className="mr-2 h-4 w-4" /> Generar XML
            </Button>
          </div>
        </CardContent>
      </Card>
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
      <CardHeader><CardTitle className="text-base">Histórico de remesas</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message ID</TableHead><TableHead>Fecha cobro</TableHead>
              <TableHead className="text-right">Operaciones</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Estado</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Cargando...</TableCell></TableRow>}
            {!isLoading && remittances.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Aún no hay remesas.</TableCell></TableRow>}
            {remittances.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.message_id}</TableCell>
                <TableCell>{r.collection_date}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.transaction_count}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{Number(r.total_amount).toFixed(2)} €</TableCell>
                <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => downloadXml(`${r.message_id}.xml`, r.xml_content)}>
                    <Download className="mr-2 h-4 w-4" /> XML
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
