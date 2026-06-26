import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Upload,
  Send,
  Download,
  Trash2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { parseCsv, parseAmount, parseDate } from "@/lib/csv";
import {
  generateSepaXml,
  validateRemittance,
  downloadXml,
  type SepaInvoiceInput,
} from "@/lib/sepa";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/factunexa")({
  ssr: false,
  head: () => ({ meta: [{ title: "FactuNexa · Nexa Suite" }] }),
  component: FactuNexaPage,
});

type PaymentMethod =
  | "transferencia"
  | "domiciliacion"
  | "efectivo"
  | "bizum"
  | "tarjeta"
  | "paypal"
  | "cheque"
  | "otro";

type PaymentStatus = "pending" | "paid";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "domiciliacion", label: "Domiciliación bancaria (SEPA DD)" },
  { value: "efectivo", label: "Efectivo" },
  { value: "bizum", label: "Bizum" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "paypal", label: "PayPal" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
];

type Invoice = {
  id: string;
  client_id: string;
  mandate_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  currency: string;
  concept: string | null;
  pdf_path: string | null;
  status: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_at: string | null;
};

type ClientLite = {
  id: string;
  name: string;
  iban: string | null;
  bic: string | null;
  email: string | null;
  tax_id: string | null;
};

type Remittance = Tables<"remittances">;
type SepaMandate = Tables<"sepa_mandates">;

function useClients() {
  return useQuery({
    queryKey: ["clients-lite"],
    queryFn: async (): Promise<ClientLite[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, iban, bic, email, tax_id")
        .order("name");
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
        .select(
          "id, client_id, mandate_id, invoice_number, issue_date, due_date, amount, currency, concept, pdf_path, status, payment_method, payment_status, paid_at",
        )
        .order("due_date", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((i) => ({
        ...i,
        amount: Number(i.amount),
        payment_method: (i.payment_method as PaymentMethod) ?? "transferencia",
        payment_status: (i.payment_status as PaymentStatus) ?? "pending",
        paid_at: i.paid_at ?? null,
      }));
    },
  });
}

function useActiveMandates() {
  return useQuery({
    queryKey: ["all-mandates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sepa_mandates")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;

      const map = new Map<string, SepaMandate>();
      for (const m of data ?? []) {
        if (!map.has(m.client_id)) map.set(m.client_id, m);
      }
      return map;
    },
  });
}

function useRemittances() {
  return useQuery({
    queryKey: ["remittances"],
    queryFn: async (): Promise<Remittance[]> => {
      const { data, error } = await supabase
        .from("remittances")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

function FactuNexaPage() {
  return (
    <AppShell title="FactuNexa">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">FactuNexa</h2>
          <p className="text-sm text-muted-foreground">
            Importa facturas y genera remesas SEPA pain.008.001.02.
          </p>
        </div>

        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="remit">Remesas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <InvoicesTab />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsTab />
          </TabsContent>

          <TabsContent value="remit">
            <RemittanceTab />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ─────────────────────────────────────────────
   CLIENTES TAB
───────────────────────────────────────────── */
function ClientsTab() {
  const qc = useQueryClient();
  const canEdit = useCanEdit();
  const { data: clients = [], isLoading } = useClients();
  const { data: mandatesByClient = new Map<string, SepaMandate>() } =
    useActiveMandates();

  const [editingClient, setEditingClient] = useState<ClientLite | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mandateFile, setMandateFile] = useState<File | null>(null);
  const [newMandateFile, setNewMandateFile] = useState<File | null>(null);

  const uploadMandatePdf = async (clientId: string, file: File) => {
    if (file.type !== "application/pdf") {
      throw new Error("Solo se admiten PDF para el mandato SEPA");
    }

    const safeName = file.name
      .replace(/\.pdf$/i, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    const path = `mandates/${clientId}/${Date.now()}-${safeName || "mandato"}.pdf`;

    const { error } = await supabase.storage.from("facturas").upload(path, file, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (error) {
      throw new Error(
        error.message.includes("Bucket not found")
          ? "No existe un bucket disponible para PDFs."
          : error.message,
      );
    }

    return path;
  };

  const updateClientMut = useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      iban: string | null;
      bic: string | null;
      email: string | null;
      tax_id: string | null;
      mandate_reference: string | null;
      mandate_signature_date: string | null;
      mandate_sequence_type: "FRST" | "RCUR" | "OOFF" | "FNAL";
      mandate_status: "activo" | "pendiente" | "cancelado";
      mandate_pdf_path: string | null;
    }) => {
      const { error: clientError } = await supabase
        .from("clients")
        .update({
          name: payload.name,
          iban: payload.iban,
          bic: payload.bic,
          email: payload.email,
          tax_id: payload.tax_id,
        })
        .eq("id", payload.id);

      if (clientError) throw clientError;

      const existingMandate = mandatesByClient.get(payload.id);

      const mandatePayload = {
        client_id: payload.id,
        mandate_reference: payload.mandate_reference ?? "",
        signature_date: payload.mandate_signature_date || null,
        iban: payload.iban,
        bic: payload.bic,
        sequence_type: payload.mandate_sequence_type,
        is_active: payload.mandate_status === "activo",
        pdf_path: payload.mandate_pdf_path,
      };

      const hasMandateData =
        !!mandatePayload.mandate_reference ||
        !!mandatePayload.signature_date ||
        !!mandatePayload.iban ||
        !!mandatePayload.bic ||
        !!mandatePayload.pdf_path;

      if (hasMandateData) {
        if (existingMandate?.id) {
          const { error: mandateError } = await supabase
            .from("sepa_mandates")
            .update(mandatePayload)
            .eq("id", existingMandate.id);

          if (mandateError) throw mandateError;
        } else {
          const { error: mandateError } = await supabase
            .from("sepa_mandates")
            .insert(mandatePayload);

          if (mandateError) throw mandateError;
        }
      }
    },
    onSuccess: () => {
      toast.success("Cliente actualizado");
      qc.invalidateQueries({ queryKey: ["clients-lite"] });
      qc.invalidateQueries({ queryKey: ["all-mandates"] });
      setEditingClient(null);
      setMandateFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createClientMut = useMutation({
    mutationFn: async (payload: {
      name: string;
      iban: string | null;
      bic: string | null;
      email: string | null;
      tax_id: string | null;
      mandate_reference: string | null;
      mandate_signature_date: string | null;
      mandate_sequence_type: "FRST" | "RCUR" | "OOFF" | "FNAL";
      mandate_status: "activo" | "pendiente" | "cancelado";
      mandate_pdf_path: string | null;
    }) => {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({
          name: payload.name,
          iban: payload.iban,
          bic: payload.bic,
          email: payload.email,
          tax_id: payload.tax_id,
        })
        .select("id")
        .single();

      if (clientError) throw clientError;
      if (!client) throw new Error("No se pudo crear el cliente");

      const mandatePayload = {
        client_id: client.id,
        mandate_reference: payload.mandate_reference ?? "",
        signature_date: payload.mandate_signature_date || null,
        iban: payload.iban,
        bic: payload.bic,
        sequence_type: payload.mandate_sequence_type,
        is_active: payload.mandate_status === "activo",
        pdf_path: payload.mandate_pdf_path,
      };

      const hasMandateData =
        !!mandatePayload.mandate_reference ||
        !!mandatePayload.signature_date ||
        !!mandatePayload.iban ||
        !!mandatePayload.bic ||
        !!mandatePayload.pdf_path;

      if (hasMandateData) {
        const { error: mandateError } = await supabase
          .from("sepa_mandates")
          .insert(mandatePayload);

        if (mandateError) throw mandateError;
      }

      return client.id;
    },
    onSuccess: () => {
      toast.success("Cliente creado");
      qc.invalidateQueries({ queryKey: ["clients-lite"] });
      qc.invalidateQueries({ queryKey: ["all-mandates"] });
      setCreateOpen(false);
      setNewMandateFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onEditClientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingClient) return;

    const fd = new FormData(e.currentTarget);
    let mandatePdfPath = mandatesByClient.get(editingClient.id)?.pdf_path ?? null;

    if (mandateFile) {
      mandatePdfPath = await uploadMandatePdf(editingClient.id, mandateFile);
    }

    updateClientMut.mutate({
      id: editingClient.id,
      name: String(fd.get("name") ?? "").trim(),
      iban: String(fd.get("iban") ?? "").trim() || null,
      bic: String(fd.get("bic") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim() || null,
      tax_id: String(fd.get("tax_id") ?? "").trim() || null,
      mandate_reference: String(fd.get("mandate_reference") ?? "").trim() || null,
      mandate_signature_date:
        String(fd.get("mandate_signature_date") ?? "").trim() || null,
      mandate_sequence_type:
        (String(fd.get("mandate_sequence_type") ?? "RCUR") as
          | "FRST"
          | "RCUR"
          | "OOFF"
          | "FNAL"),
      mandate_status: String(fd.get("mandate_status") ?? "pendiente") as
        | "activo"
        | "pendiente"
        | "cancelado",
      mandate_pdf_path: mandatePdfPath,
    });
  }

  async function onCreateClientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    let tempPdfPath: string | null = null;

    if (newMandateFile) {
      tempPdfPath = `pending-upload`;
    }

    const name = String(fd.get("name") ?? "").trim();
    const iban = String(fd.get("iban") ?? "").trim() || null;
    const bic = String(fd.get("bic") ?? "").trim() || null;
    const email = String(fd.get("email") ?? "").trim() || null;
    const tax_id = String(fd.get("tax_id") ?? "").trim() || null;
    const mandate_reference =
      String(fd.get("mandate_reference") ?? "").trim() || null;
    const mandate_signature_date =
      String(fd.get("mandate_signature_date") ?? "").trim() || null;
    const mandate_sequence_type = String(
      fd.get("mandate_sequence_type") ?? "RCUR",
    ) as "FRST" | "RCUR" | "OOFF" | "FNAL";
    const mandate_status = String(fd.get("mandate_status") ?? "pendiente") as
      | "activo"
      | "pendiente"
      | "cancelado";

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        name,
        iban,
        bic,
        email,
        tax_id,
      })
      .select("id")
      .single();

    if (clientError) {
      toast.error(clientError.message);
      return;
    }

    if (!client) {
      toast.error("No se pudo crear el cliente");
      return;
    }

    let mandatePdfPath: string | null = null;
    if (newMandateFile) {
      mandatePdfPath = await uploadMandatePdf(client.id, newMandateFile);
    }

    const hasMandateData =
      !!mandate_reference ||
      !!mandate_signature_date ||
      !!iban ||
      !!bic ||
      !!mandatePdfPath;

    if (hasMandateData) {
      const { error: mandateError } = await supabase.from("sepa_mandates").insert({
        client_id: client.id,
        mandate_reference: mandate_reference ?? "",
        signature_date: mandate_signature_date,
        iban,
        bic,
        sequence_type: mandate_sequence_type,
        is_active: mandate_status === "activo",
        pdf_path: mandatePdfPath,
      });

      if (mandateError) {
        toast.error(mandateError.message);
        return;
      }
    }

    toast.success("Cliente creado");
    qc.invalidateQueries({ queryKey: ["clients-lite"] });
    qc.invalidateQueries({ queryKey: ["all-mandates"] });
    setCreateOpen(false);
    setNewMandateFile(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setNewMandateFile(null);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={!canEdit}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
            </DialogHeader>

            <form onSubmit={onCreateClientSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input name="name" required />
              </div>

              <div className="space-y-1.5">
                <Label>IBAN</Label>
                <Input name="iban" className="font-mono" />
              </div>

              <div className="space-y-1.5">
                <Label>BIC</Label>
                <Input name="bic" className="font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input name="email" />
                </div>
                <div className="space-y-1.5">
                  <Label>NIF / CIF</Label>
                  <Input name="tax_id" />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium">Mandato SEPA</div>

                <div className="space-y-1.5">
                  <Label>Referencia del mandato</Label>
                  <Input name="mandate_reference" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fecha de firma</Label>
                    <Input name="mandate_signature_date" type="date" />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Secuencia SEPA</Label>
                    <Select name="mandate_sequence_type" defaultValue="RCUR">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FRST">FRST</SelectItem>
                        <SelectItem value="RCUR">RCUR</SelectItem>
                        <SelectItem value="OOFF">OOFF</SelectItem>
                        <SelectItem value="FNAL">FNAL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Estado del mandato</Label>
                  <Select name="mandate_status" defaultValue="pendiente">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Mandato firmado (PDF)</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setNewMandateFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createClientMut.isPending}>
                  Crear cliente
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={!!editingClient}
        onOpenChange={(open) => {
          if (!open) {
            setEditingClient(null);
            setMandateFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>

          {editingClient && (
            <form onSubmit={onEditClientSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input name="name" defaultValue={editingClient.name} required />
              </div>

              <div className="space-y-1.5">
                <Label>IBAN</Label>
                <Input
                  name="iban"
                  defaultValue={editingClient.iban ?? ""}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label>BIC</Label>
                <Input
                  name="bic"
                  defaultValue={editingClient.bic ?? ""}
                  className="font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input name="email" defaultValue={editingClient.email ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>NIF / CIF</Label>
                  <Input name="tax_id" defaultValue={editingClient.tax_id ?? ""} />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium">Mandato SEPA</div>

                <div className="space-y-1.5">
                  <Label>Referencia del mandato</Label>
                  <Input
                    name="mandate_reference"
                    defaultValue={
                      mandatesByClient.get(editingClient.id)?.mandate_reference ?? ""
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fecha de firma</Label>
                    <Input
                      name="mandate_signature_date"
                      type="date"
                      defaultValue={
                        mandatesByClient.get(editingClient.id)?.signature_date ?? ""
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Secuencia SEPA</Label>
                    <Input
                      name="mandate_sequence_type"
                      defaultValue={
                        mandatesByClient.get(editingClient.id)?.sequence_type ?? "RCUR"
                      }
                      placeholder="FRST / RCUR / OOFF / FNAL"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Estado del mandato</Label>
                  <Input
                    name="mandate_status"
                    defaultValue={
                      mandatesByClient.get(editingClient.id)?.is_active
                        ? "activo"
                        : "pendiente"
                    }
                    placeholder="activo / pendiente / cancelado"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Mandato firmado (PDF)</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setMandateFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {mandatesByClient.get(editingClient.id)?.pdf_path
                      ? "Ya existe un PDF asociado. Puedes subir otro para reemplazarlo."
                      : "Sin PDF asociado todavía."}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updateClientMut.isPending}
                >
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead>BIC</TableHead>
                <TableHead>Mandato SEPA</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Cargando...
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && clients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Sin clientes.
                  </TableCell>
                </TableRow>
              )}

              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.iban ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.bic ?? "—"}</TableCell>
                  <TableCell>
                    {mandatesByClient.get(c.id)?.is_active ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Sin mandato</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canEdit}
                      onClick={() => setEditingClient(c)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FACTURAS TAB
───────────────────────────────────────────── */
function InvoicesTab() {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const canEdit = useCanEdit();
  const { data: clients = [] } = useClients();
  const { data: invoices = [], isLoading } = useInvoices();
  const [open, setOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editClientId, setEditClientId] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] =
    useState<PaymentMethod>("transferencia");
  const [editPaymentStatus, setEditPaymentStatus] =
    useState<PaymentStatus>("pending");

  function openEditDialog(inv: Invoice) {
    setEditingInvoice(inv);
    setEditClientId(inv.client_id);
    setEditPaymentMethod(inv.payment_method);
    setEditPaymentStatus(inv.payment_status);
  }

  function closeEditDialog() {
    setEditingInvoice(null);
  }

  const updateInvoiceMut = useMutation({
    mutationFn: async (payload: {
      id: string;
      client_id: string;
      invoice_number: string;
      issue_date: string;
      due_date: string;
      amount: number;
      concept: string | null;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      existing_paid_at: string | null;
    }) => {
      const paid_at =
        payload.payment_status === "paid"
          ? (payload.existing_paid_at ?? new Date().toISOString())
          : null;

      const { error } = await supabase
        .from("invoices")
        .update({
          client_id: payload.client_id,
          invoice_number: payload.invoice_number,
          issue_date: payload.issue_date,
          due_date: payload.due_date,
          amount: payload.amount,
          concept: payload.concept,
          payment_method: payload.payment_method,
          payment_status: payload.payment_status,
          paid_at,
        })
        .eq("id", payload.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Factura actualizada");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      closeEditDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingInvoice) return;

    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    if (!isFinite(amount) || amount <= 0) {
      return toast.error("Importe inválido");
    }

    updateInvoiceMut.mutate({
      id: editingInvoice.id,
      client_id: editClientId,
      invoice_number: String(fd.get("invoice_number")),
      issue_date: String(fd.get("issue_date")),
      due_date: String(fd.get("due_date")),
      amount,
      concept: String(fd.get("concept") ?? "").trim() || null,
      payment_method: editPaymentMethod,
      payment_status: editPaymentStatus,
      existing_paid_at: editingInvoice.paid_at,
    });
  }

  const createMut = useMutation({
    mutationFn: async (
      payload: Omit<
        Invoice,
        | "id"
        | "currency"
        | "pdf_path"
        | "status"
        | "payment_method"
        | "payment_status"
        | "paid_at"
      > & { payment_method?: PaymentMethod; payment_status?: PaymentStatus },
    ) => {
      if (!ws) throw new Error("Sin workspace");

      const paid_at =
        payload.payment_status === "paid" ? new Date().toISOString() : null;

      const { error } = await supabase.from("invoices").insert({
        workspace_id: ws.id,
        client_id: payload.client_id,
        mandate_id: payload.mandate_id,
        invoice_number: payload.invoice_number,
        issue_date: payload.issue_date,
        due_date: payload.due_date,
        amount: payload.amount,
        concept: payload.concept,
        status: "pending",
        payment_method: payload.payment_method ?? "transferencia",
        payment_status: payload.payment_status ?? "pending",
        paid_at,
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
    onSuccess: () => {
      toast.success("Factura eliminada");
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PaymentStatus }) => {
      const payload: { payment_status: PaymentStatus; paid_at: string | null } = {
        payment_status: status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      };

      const { error } = await supabase.from("invoices").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePaymentMethodMut = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: PaymentMethod }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ payment_method: method })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Método actualizado");
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      if (!ws) throw new Error("Sin workspace");

      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("CSV vacío");

      const byName = new Map(clients.map((c) => [c.name.toLowerCase(), c.id]));
      const toInsert: Array<{
        workspace_id: string;
        client_id: string;
        invoice_number: string;
        amount: number;
        issue_date: string;
        due_date: string;
        concept: string | null;
        source: string;
        status: "pending";
      }> = [];
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

        const invoice_number =
          r.invoice_number || r.numero || r.number || r.factura || "";
        if (!invoice_number) {
          errors.push(`Fila ${i + 2}: falta número`);
          continue;
        }

        const due_date =
          parseDate(r.due_date || r.vencimiento || "") ||
          new Date().toISOString().slice(0, 10);
        const issue_date = parseDate(r.issue_date || r.fecha || "") || due_date;

        toInsert.push({
          workspace_id: ws.id,
          client_id,
          invoice_number,
          amount,
          issue_date,
          due_date,
          concept: r.concept || r.concepto || null,
          source: "csv",
          status: "pending",
        });
      }

      if (!toInsert.length) {
        throw new Error(errors[0] || "No se pudo importar ninguna fila");
      }

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
    mutationFn: async (payload: {
      file: File;
      client_id: string;
      invoice_number: string;
      amount: number;
      issue_date: string;
      due_date: string;
      concept: string | null;
    }) => {
      if (!ws) throw new Error("Sin workspace");
      const { file } = payload;

      if (file.type !== "application/pdf") {
        throw new Error("Solo se admiten archivos PDF");
      }

      const safeName = file.name
        .replace(/\.pdf$/i, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

      const path = `${ws.id}/${Date.now()}-${safeName || "factura"}.pdf`;

      const { error } = await supabase.storage.from("facturas").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });

      if (error) {
        throw new Error(
          error.message.includes("Bucket not found")
            ? "No existe el bucket facturas. Aplica la migración de Storage antes de importar PDFs."
            : error.message,
        );
      }

      const { error: insertError } = await supabase.from("invoices").insert({
        workspace_id: ws.id,
        client_id: payload.client_id,
        invoice_number: payload.invoice_number,
        issue_date: payload.issue_date,
        due_date: payload.due_date,
        amount: payload.amount,
        concept: payload.concept,
        pdf_path: path,
        source: "pdf",
        status: "pending",
      });

      if (insertError) throw insertError;
      return path;
    },
    onSuccess: () => {
      toast.success("PDF subido y factura creada");
      setPdfOpen(false);
      setPdfFile(null);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));

    if (!isFinite(amount) || amount <= 0) {
      return toast.error("Importe inválido");
    }

    createMut.mutate({
      client_id: String(fd.get("client_id")),
      mandate_id: null,
      invoice_number: String(fd.get("invoice_number")),
      issue_date: String(fd.get("issue_date")),
      due_date: String(fd.get("due_date")),
      amount,
      concept: String(fd.get("concept") ?? "").trim() || null,
      payment_method: String(fd.get("payment_method") ?? "transferencia") as PaymentMethod,
      payment_status: String(fd.get("payment_status") ?? "pending") as PaymentStatus,
    });
  }

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setPdfOpen(true);
    }
    e.currentTarget.value = "";
  }

  function onPdfSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pdfFile) return toast.error("Selecciona un PDF");

    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));

    if (!isFinite(amount) || amount <= 0) {
      return toast.error("Importe inválido");
    }

    importPdfMut.mutate({
      file: pdfFile,
      client_id: String(fd.get("client_id")),
      invoice_number: String(fd.get("invoice_number")),
      issue_date: String(fd.get("issue_date")),
      due_date: String(fd.get("due_date")),
      amount,
      concept: String(fd.get("concept") ?? "").trim() || null,
    });
  }

  return (
    <div className="space-y-4">
      <Dialog
        open={!!editingInvoice}
        onOpenChange={(o) => {
          if (!o) closeEditDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar factura</DialogTitle>
          </DialogHeader>

          {editingInvoice && (
            <form onSubmit={onEditSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={editClientId} onValueChange={setEditClientId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Número *</Label>
                  <Input
                    name="invoice_number"
                    defaultValue={editingInvoice.invoice_number}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Importe (€) *</Label>
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={editingInvoice.amount}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Emisión</Label>
                  <Input
                    name="issue_date"
                    type="date"
                    defaultValue={editingInvoice.issue_date}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vencimiento *</Label>
                  <Input
                    name="due_date"
                    type="date"
                    defaultValue={editingInvoice.due_date}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Concepto</Label>
                <Input name="concept" defaultValue={editingInvoice.concept ?? ""} />
              </div>

              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select
                  value={editPaymentMethod}
                  onValueChange={(v) => setEditPaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={editPaymentStatus}
                  onValueChange={(v) => setEditPaymentStatus(v as PaymentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">⏳ Pendiente</SelectItem>
                    <SelectItem value="paid">✓ Pagada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEditDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateInvoiceMut.isPending}>
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importMut.mutate(f);
            e.currentTarget.value = "";
          }}
        />
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={!canEdit || importMut.isPending}
        >
          <Upload className="mr-2 h-4 w-4" />
          Importar CSV
        </Button>

        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handlePdfChange}
        />
        <Button
          variant="outline"
          onClick={() => pdfRef.current?.click()}
          disabled={!canEdit || importPdfMut.isPending}
        >
          <Upload className="mr-2 h-4 w-4" />
          Importar PDF
        </Button>

        <Dialog
          open={pdfOpen}
          onOpenChange={(next) => {
            setPdfOpen(next);
            if (!next) setPdfFile(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar factura PDF</DialogTitle>
            </DialogHeader>

            <form onSubmit={onPdfSubmit} className="space-y-3">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="truncate font-medium">{pdfFile?.name}</div>
                <div className="text-xs text-muted-foreground">
                  El PDF se guardará y quedará vinculado a la factura.
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select name="client_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Número *</Label>
                  <Input name="invoice_number" required />
                </div>

                <div className="space-y-1.5">
                  <Label>Importe (€) *</Label>
                  <Input name="amount" type="number" step="0.01" required />
                </div>

                <div className="space-y-1.5">
                  <Label>Emisión</Label>
                  <Input
                    name="issue_date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vencimiento *</Label>
                  <Input
                    name="due_date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Concepto</Label>
                <Input name="concept" />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={importPdfMut.isPending}>
                  Crear factura
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canEdit}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva factura
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva factura</DialogTitle>
            </DialogHeader>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select name="client_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Número *</Label>
                  <Input name="invoice_number" required />
                </div>

                <div className="space-y-1.5">
                  <Label>Importe (€) *</Label>
                  <Input name="amount" type="number" step="0.01" required />
                </div>

                <div className="space-y-1.5">
                  <Label>Emisión</Label>
                  <Input
                    name="issue_date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vencimiento *</Label>
                  <Input
                    name="due_date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Concepto</Label>
                <Input name="concept" />
              </div>

              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select name="payment_method" defaultValue="transferencia">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Estado inicial</Label>
                <Select name="payment_status" defaultValue="pending">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">⏳ Pendiente</SelectItem>
                    <SelectItem value="paid">✓ Pagada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Cargando...
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && invoices.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Sin facturas. Crea una, importa un CSV o sube un PDF.
                  </TableCell>
                </TableRow>
              )}

              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">
                    {inv.invoice_number}
                  </TableCell>
                  <TableCell>{clientName(inv.client_id)}</TableCell>
                  <TableCell>{inv.due_date}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {inv.amount.toFixed(2)} €
                  </TableCell>
                  <TableCell>
                    <Select
                      value={inv.payment_method}
                      onValueChange={(v) =>
                        updatePaymentMethodMut.mutate({
                          id: inv.id,
                          method: v as PaymentMethod,
                        })
                      }
                      disabled={
                        updatePaymentMethodMut.isPending || toggleStatusMut.isPending
                      }
                    >
                      <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs border-none bg-transparent shadow-none focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          inv.payment_status === "paid"
                            ? "default"
                            : inv.status === "included"
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          inv.payment_status === "paid"
                            ? "bg-green-600 hover:bg-green-700"
                            : inv.status === "included"
                            ? ""
                            : "border-amber-500 text-amber-700"
                        }
                      >
                        {inv.payment_status === "paid"
                          ? "✓ Pagada"
                          : inv.status === "included"
                          ? "En remesa"
                          : "⏳ Pendiente"}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        disabled={
                          !canEdit ||
                          updatePaymentMethodMut.isPending ||
                          toggleStatusMut.isPending
                        }
                        onClick={() =>
                          toggleStatusMut.mutate({
                            id: inv.id,
                            status: inv.payment_status === "pending" ? "paid" : "pending",
                          })
                        }
                      >
                        {inv.payment_status === "pending"
                          ? "Marcar pagada"
                          : "Marcar pendiente"}
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canEdit}
                        onClick={() => openEditDialog(inv)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canEdit}
                        onClick={() => {
                          if (confirm("¿Eliminar factura?")) deleteMut.mutate(inv.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        CSV admite columnas:{" "}
        <code>client,invoice_number,amount,due_date,issue_date,concept</code>{" "}
        (también acepta nombres en español: cliente, numero, importe, vencimiento,
        fecha, concepto).
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   REMESAS TAB
───────────────────────────────────────────── */
function RemittanceTab() {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const canEdit = useCanEdit();
  const { data: invoices = [] } = useInvoices();
  const { data: clients = [] } = useClients();
  const { data: remittances = [] } = useRemittances();
  const { data: mandatesByClient = new Map<string, SepaMandate>() } =
    useActiveMandates();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creditorName, setCreditorName] = useState("");
  const [creditorIban, setCreditorIban] = useState("");
  const [creditorBic, setCreditorBic] = useState("");
  const [creditorId, setCreditorId] = useState("");
  const [collectionDate, setCollectionDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
  );
  const [issues, setIssues] = useState<string[]>([]);

  const [editingRemittance, setEditingRemittance] = useState<Remittance | null>(null);
  const [editRemittanceStatus, setEditRemittanceStatus] = useState("");
  const [editRemittanceCollectionDate, setEditRemittanceCollectionDate] =
    useState("");

  const pending = invoices.filter((i) => i.payment_status === "pending" && i.status !== "included");

  const total = useMemo(
    () => invoices.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.amount, 0),
    [invoices, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
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

    return {
      messageId,
      creditorName,
      creditorIban,
      creditorBic: creditorBic || null,
      creditorId,
      collectionDate,
      invoices: sepaInvoices,
    };
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

      const { data: rem, error } = await supabase
        .from("remittances")
        .insert({
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
        })
        .select()
        .single();

      if (error) throw error;

      const { error: linkError } = await supabase.from("remittance_invoices").insert(
        input.invoices.map((i) => ({
          remittance_id: rem.id,
          invoice_id: i.invoiceId,
          amount: i.amount,
        })),
      );

      if (linkError) throw linkError;

      const { error: invError } = await supabase
        .from("invoices")
        .update({ status: "included" })
        .in(
          "id",
          input.invoices.map((i) => i.invoiceId),
        );

      if (invError) throw invError;

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

  const updateRemittanceMut = useMutation({
    mutationFn: async (payload: {
      id: string;
      status: string;
      collection_date: string;
    }) => {
      const { error } = await supabase
        .from("remittances")
        .update({
          status: payload.status,
          collection_date: payload.collection_date,
        })
        .eq("id", payload.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Remesa actualizada");
      qc.invalidateQueries({ queryKey: ["remittances"] });
      setEditingRemittance(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRemittanceMut = useMutation({
    mutationFn: async (remittanceId: string) => {
      const { data: items, error: itemsError } = await supabase
        .from("remittance_invoices")
        .select("invoice_id")
        .eq("remittance_id", remittanceId);

      if (itemsError) throw itemsError;

      const invoiceIds = (items ?? []).map((x) => x.invoice_id).filter(Boolean);

      if (invoiceIds.length) {
        const { error: resetInvoicesError } = await supabase
          .from("invoices")
          .update({ status: "pending" })
          .in("id", invoiceIds);

        if (resetInvoicesError) throw resetInvoicesError;
      }

      const { error: deleteLinksError } = await supabase
        .from("remittance_invoices")
        .delete()
        .eq("remittance_id", remittanceId);

      if (deleteLinksError) throw deleteLinksError;

      const { error: deleteRemError } = await supabase
        .from("remittances")
        .delete()
        .eq("id", remittanceId);

      if (deleteRemError) throw deleteRemError;
    },
    onSuccess: () => {
      toast.success("Remesa eliminada");
      qc.invalidateQueries({ queryKey: ["remittances"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function preview() {
    const found = validateRemittance(buildInput());
    setIssues(found.map((f) => f.message));
    if (!found.length) toast.success("Validación OK. Lista para generar.");
    else toast.error(`${found.length} problemas encontrados`);
  }

  function openEditRemittance(rem: Remittance) {
    setEditingRemittance(rem);
    setEditRemittanceStatus(rem.status ?? "generated");
    setEditRemittanceCollectionDate(rem.collection_date ?? "");
  }

  return (
    <div className="space-y-6">
      <Dialog
        open={!!editingRemittance}
        onOpenChange={(open) => {
          if (!open) setEditingRemittance(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar remesa</DialogTitle>
          </DialogHeader>

          {editingRemittance && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRemittanceMut.mutate({
                  id: editingRemittance.id,
                  status: editRemittanceStatus,
                  collection_date: editRemittanceCollectionDate,
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label>Message ID</Label>
                <Input value={editingRemittance.message_id ?? ""} disabled />
              </div>

              <div className="space-y-1.5">
                <Label>Fecha de cobro</Label>
                <Input
                  type="date"
                  value={editRemittanceCollectionDate}
                  onChange={(e) => setEditRemittanceCollectionDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input
                  value={editRemittanceStatus}
                  onChange={(e) => setEditRemittanceStatus(e.target.value)}
                  placeholder="generated / sent / paid / cancelled"
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={updateRemittanceMut.isPending}>
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Selecciona facturas a incluir</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Mandato</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-sm text-muted-foreground"
                    >
                      Sin facturas pendientes.
                    </TableCell>
                  </TableRow>
                )}

                {pending.map((inv) => {
                  const m = mandatesByClient.get(inv.client_id);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(inv.id)}
                          onCheckedChange={() => toggle(inv.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.invoice_number}
                      </TableCell>
                      <TableCell>
                        {clients.find((c) => c.id === inv.client_id)?.name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m ? (
                          <span className="font-mono text-foreground">
                            {m.mandate_reference}
                          </span>
                        ) : (
                          <span className="text-destructive">sin mandato</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {inv.amount.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del acreedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={creditorName} onChange={(e) => setCreditorName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>IBAN</Label>
              <Input
                value={creditorIban}
                onChange={(e) => setCreditorIban(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>BIC (opcional)</Label>
              <Input
                value={creditorBic}
                onChange={(e) => setCreditorBic(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Identificador acreedor (Creditor ID)</Label>
              <Input
                value={creditorId}
                onChange={(e) => setCreditorId(e.target.value)}
                placeholder="ESxxZZZxxxxxxxxx"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Fecha de cobro</Label>
              <Input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operaciones</span>
                <span className="font-mono tabular-nums">{selected.size}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span className="font-mono tabular-nums">{total.toFixed(2)} €</span>
              </div>
            </div>

            {issues.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <div className="mb-1 flex items-center gap-1 font-medium text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  Errores de validación
                </div>
                <ul className="list-disc space-y-0.5 pl-4 text-destructive">
                  {issues.slice(0, 8).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {issues.length > 8 && <li>… y {issues.length - 8} más</li>}
                </ul>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={preview}
                disabled={selected.size === 0}
                className="flex-1"
              >
                Validar
              </Button>
              <Button
                onClick={() => generateMut.mutate()}
                disabled={!canEdit || selected.size === 0 || generateMut.isPending}
                className="flex-1"
              >
                <Send className="mr-2 h-4 w-4" />
                Generar XML
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gestión de remesas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message ID</TableHead>
                <TableHead>Fecha cobro</TableHead>
                <TableHead className="text-right">Operaciones</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remittances.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Aún no hay remesas.
                  </TableCell>
                </TableRow>
              )}

              {remittances.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.message_id}</TableCell>
                  <TableCell>{r.collection_date}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.transaction_count}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {Number(r.total_amount).toFixed(2)} €
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadXml(`${r.message_id}.xml`, r.xml_content)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        XML
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canEdit}
                        onClick={() => openEditRemittance(r)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canEdit}
                        onClick={() => {
                          if (confirm("¿Eliminar remesa? Las facturas volverán a pendientes.")) {
                            deleteRemittanceMut.mutate(r.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   HISTÓRICO TAB
───────────────────────────────────────────── */
function HistoryTab() {
  const { data: remittances = [], isLoading } = useRemittances();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de remesas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message ID</TableHead>
              <TableHead>Fecha cobro</TableHead>
              <TableHead className="text-right">Operaciones</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  Cargando...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && remittances.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  Aún no hay remesas.
                </TableCell>
              </TableRow>
            )}

            {remittances.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.message_id}</TableCell>
                <TableCell>{r.collection_date}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.transaction_count}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {Number(r.total_amount).toFixed(2)} €
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadXml(`${r.message_id}.xml`, r.xml_content)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    XML
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