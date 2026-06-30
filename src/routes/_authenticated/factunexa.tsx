import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
type MandateSequenceType = "FRST" | "RCUR" | "OOFF" | "FNAL";
type MandateStatus = "activo" | "pendiente" | "cancelado";
type RemittanceStatus = "draft" | "generated" | "processed" | "submitted";

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

type ClientFormState = {
  name: string;
  iban: string;
  bic: string;
  email: string;
  tax_id: string;
  mandate_reference: string;
  mandate_signature_date: string;
  mandate_sequence_type: MandateSequenceType;
  mandate_status: MandateStatus;
};

type InvoiceFormState = {
  client_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: string;
  concept: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultClientForm(): ClientFormState {
  return {
    name: "",
    iban: "",
    bic: "",
    email: "",
    tax_id: "",
    mandate_reference: "",
    mandate_signature_date: "",
    mandate_sequence_type: "RCUR",
    mandate_status: "pendiente",
  };
}

function defaultInvoiceForm(): InvoiceFormState {
  return {
    client_id: "",
    invoice_number: "",
    issue_date: today(),
    due_date: today(),
    amount: "",
    concept: "",
    payment_method: "transferencia",
    payment_status: "pending",
  };
}

function normalizeNullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validatePositiveAmount(raw: string) {
  const value = Number(raw);
  if (!isFinite(value) || value <= 0) {
    throw new Error("Importe inválido");
  }
  return value;
}

function validateRequired(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} es obligatorio`);
  return trimmed;
}

function useCanEdit() {
  const { data: ws } = useCurrentWorkspace();

  const role =
    (ws as { role?: string | null; member_role?: string | null } | undefined)
      ?.role ??
    (ws as { role?: string | null; member_role?: string | null } | undefined)
      ?.member_role ??
    null;

  if (!role) return true;

  return ["owner", "admin", "editor", "manager"].includes(role);
}

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

function ClientsTab() {
  const qc = useQueryClient();
  const canEdit = useCanEdit();
  const { data: ws } = useCurrentWorkspace();
  const { data: clients = [], isLoading } = useClients();
  const { data: mandatesByClient = new Map<string, SepaMandate>() } =
    useActiveMandates();

  const [editingClient, setEditingClient] = useState<ClientLite | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mandateFile, setMandateFile] = useState<File | null>(null);
  const [newMandateFile, setNewMandateFile] = useState<File | null>(null);
  const [createForm, setCreateForm] = useState<ClientFormState>(defaultClientForm());
  const [editForm, setEditForm] = useState<ClientFormState>(defaultClientForm());

  const uploadMandatePdf = async (
    workspaceId: string,
    clientId: string,
    file: File,
  ) => {
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

    // Path MUST start with workspaceId to satisfy storage RLS policy
    const path = `${workspaceId}/${clientId}/${Date.now()}-${safeName || "mandato"}.pdf`;
    const { error } = await supabase.storage
      .from("sepa-mandates")
      .upload(path, file, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("Bucket not found")) {
        throw new Error(
          "No existe el bucket 'sepa-mandates'. Pide al admin que aplique las migraciones de Storage.",
        );
      }
      if (msg.toLowerCase().includes("row-level security")) {
        throw new Error(
          "El path no cumple la policy del bucket (debe empezar por el workspace).",
        );
      }
      throw new Error(`No se pudo subir el PDF del mandato: ${msg}`);
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
      mandate_sequence_type: MandateSequenceType;
      mandate_status: MandateStatus;
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

      const mandatePayloadBase = {
        client_id: payload.id,
        debtor_name: payload.name,
        mandate_reference: payload.mandate_reference ?? "",
        signature_date: payload.mandate_signature_date ?? "",
        iban: payload.iban ?? "",
        bic: payload.bic,
        sequence_type: payload.mandate_sequence_type,
        is_active: payload.mandate_status === "activo",
        status: payload.mandate_status,
        pdf_path: payload.mandate_pdf_path,
      };

      const hasMandateData =
        !!mandatePayloadBase.mandate_reference ||
        !!mandatePayloadBase.signature_date ||
        !!mandatePayloadBase.iban ||
        !!mandatePayloadBase.bic ||
        !!mandatePayloadBase.pdf_path;

      if (hasMandateData) {
        if (existingMandate?.id) {
          const { error: mandateError } = await supabase
            .from("sepa_mandates")
            .update(mandatePayloadBase)
            .eq("id", existingMandate.id);

          if (mandateError) throw mandateError;
        } else {
          if (!ws?.id) throw new Error("Workspace no disponible");
          if (!mandatePayloadBase.mandate_reference)
            throw new Error("Referencia de mandato obligatoria");
          if (!mandatePayloadBase.signature_date)
            throw new Error("Fecha de firma del mandato obligatoria");
          if (!mandatePayloadBase.iban)
            throw new Error("IBAN del mandato obligatorio");
          const { error: mandateError } = await supabase
            .from("sepa_mandates")
            .insert({ ...mandatePayloadBase, workspace_id: ws.id });

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
      setEditForm(defaultClientForm());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEditClient(client: ClientLite) {
    const mandate = mandatesByClient.get(client.id);

    setEditingClient(client);
    setMandateFile(null);
    setEditForm({
      name: client.name ?? "",
      iban: client.iban ?? "",
      bic: client.bic ?? "",
      email: client.email ?? "",
      tax_id: client.tax_id ?? "",
      mandate_reference: mandate?.mandate_reference ?? "",
      mandate_signature_date: mandate?.signature_date ?? "",
      mandate_sequence_type: (mandate?.sequence_type as MandateSequenceType) ?? "RCUR",
      mandate_status: mandate?.is_active ? "activo" : "pendiente",
    });
  }

  async function onEditClientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingClient) return;

    try {
      if (!ws?.id) throw new Error("Workspace no disponible");
      const name = validateRequired(editForm.name, "Nombre");
      let mandatePdfPath = mandatesByClient.get(editingClient.id)?.pdf_path ?? null;

      if (mandateFile) {
        mandatePdfPath = await uploadMandatePdf(ws.id, editingClient.id, mandateFile);
      }

      updateClientMut.mutate({
        id: editingClient.id,
        name,
        iban: normalizeNullable(editForm.iban),
        bic: normalizeNullable(editForm.bic),
        email: normalizeNullable(editForm.email),
        tax_id: normalizeNullable(editForm.tax_id),
        mandate_reference: normalizeNullable(editForm.mandate_reference),
        mandate_signature_date: normalizeNullable(editForm.mandate_signature_date),
        mandate_sequence_type: editForm.mandate_sequence_type,
        mandate_status: editForm.mandate_status,
        mandate_pdf_path: mandatePdfPath,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar cliente");
    }
  }

  async function onCreateClientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      if (!ws?.id) throw new Error("Workspace no disponible");
      const name = validateRequired(createForm.name, "Nombre");

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({
          workspace_id: ws.id,
          name,
          iban: normalizeNullable(createForm.iban),
          bic: normalizeNullable(createForm.bic),
          email: normalizeNullable(createForm.email),
          tax_id: normalizeNullable(createForm.tax_id),
        })
        .select("id")
        .single();

      if (clientError) throw clientError;
      if (!client) throw new Error("No se pudo crear el cliente");

      let mandatePdfPath: string | null = null;
      if (newMandateFile) {
        mandatePdfPath = await uploadMandatePdf(ws.id, client.id, newMandateFile);
      }

      const mandateRef = normalizeNullable(createForm.mandate_reference);
      const mandateSig = normalizeNullable(createForm.mandate_signature_date);
      const mandateIban = normalizeNullable(createForm.iban);

      const hasMandateData =
        !!mandateRef || !!mandateSig || !!mandateIban || !!mandatePdfPath;

      if (hasMandateData) {
        if (!mandateRef) throw new Error("Referencia de mandato obligatoria");
        if (!mandateSig) throw new Error("Fecha de firma del mandato obligatoria");
        if (!mandateIban) throw new Error("IBAN del mandato obligatorio");
        const { error: mandateError } = await supabase.from("sepa_mandates").insert({
          workspace_id: ws.id,
          client_id: client.id,
          debtor_name: name,
          mandate_reference: mandateRef,
          signature_date: mandateSig,
          iban: mandateIban,
          bic: normalizeNullable(createForm.bic),
          sequence_type: createForm.mandate_sequence_type,
          is_active: createForm.mandate_status === "activo",
          status: createForm.mandate_status,
          pdf_path: mandatePdfPath,
        });

        if (mandateError) throw mandateError;
      }

      toast.success("Cliente creado");
      qc.invalidateQueries({ queryKey: ["clients-lite"] });
      qc.invalidateQueries({ queryKey: ["all-mandates"] });
      setCreateOpen(false);
      setNewMandateFile(null);
      setCreateForm(defaultClientForm());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear cliente");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) {
              setNewMandateFile(null);
              setCreateForm(defaultClientForm());
            }
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
                <Input
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>IBAN</Label>
                <Input
                  className="font-mono"
                  value={createForm.iban}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, iban: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>BIC</Label>
                <Input
                  className="font-mono"
                  value={createForm.bic}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, bic: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>NIF / CIF</Label>
                  <Input
                    value={createForm.tax_id}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, tax_id: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium">Mandato SEPA</div>

                <div className="space-y-1.5">
                  <Label>Referencia del mandato</Label>
                  <Input
                    value={createForm.mandate_reference}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        mandate_reference: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fecha de firma</Label>
                    <Input
                      type="date"
                      value={createForm.mandate_signature_date}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          mandate_signature_date: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Secuencia SEPA</Label>
                    <Select
                      value={createForm.mandate_sequence_type}
                      onValueChange={(v) =>
                        setCreateForm((p) => ({
                          ...p,
                          mandate_sequence_type: v as MandateSequenceType,
                        }))
                      }
                    >
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
                  <Select
                    value={createForm.mandate_status}
                    onValueChange={(v) =>
                      setCreateForm((p) => ({
                        ...p,
                        mandate_status: v as MandateStatus,
                      }))
                    }
                  >
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
                <Button type="submit">Crear cliente</Button>
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
            setEditForm(defaultClientForm());
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
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>IBAN</Label>
                <Input
                  className="font-mono"
                  value={editForm.iban}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, iban: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>BIC</Label>
                <Input
                  className="font-mono"
                  value={editForm.bic}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, bic: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>NIF / CIF</Label>
                  <Input
                    value={editForm.tax_id}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, tax_id: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium">Mandato SEPA</div>

                <div className="space-y-1.5">
                  <Label>Referencia del mandato</Label>
                  <Input
                    value={editForm.mandate_reference}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        mandate_reference: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fecha de firma</Label>
                    <Input
                      type="date"
                      value={editForm.mandate_signature_date}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          mandate_signature_date: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Secuencia SEPA</Label>
                    <Select
                      value={editForm.mandate_sequence_type}
                      onValueChange={(v) =>
                        setEditForm((p) => ({
                          ...p,
                          mandate_sequence_type: v as MandateSequenceType,
                        }))
                      }
                    >
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
                  <Select
                    value={editForm.mandate_status}
                    onValueChange={(v) =>
                      setEditForm((p) => ({
                        ...p,
                        mandate_status: v as MandateStatus,
                      }))
                    }
                  >
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
                <Button type="submit" disabled={updateClientMut.isPending}>
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
                      onClick={() => openEditClient(c)}
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
  const [createInvoiceForm, setCreateInvoiceForm] =
    useState<InvoiceFormState>(defaultInvoiceForm());
  const [pdfInvoiceForm, setPdfInvoiceForm] =
    useState<InvoiceFormState>(defaultInvoiceForm());
  const [editInvoiceForm, setEditInvoiceForm] =
    useState<InvoiceFormState>(defaultInvoiceForm());

  function openEditDialog(inv: Invoice) {
    setEditingInvoice(inv);
    setEditInvoiceForm({
      client_id: inv.client_id,
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      amount: String(inv.amount),
      concept: inv.concept ?? "",
      payment_method: inv.payment_method,
      payment_status: inv.payment_status,
    });
  }

  function closeEditDialog() {
    setEditingInvoice(null);
    setEditInvoiceForm(defaultInvoiceForm());
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
      setCreateInvoiceForm(defaultInvoiceForm());
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

        const due_date = parseDate(r.due_date || r.vencimiento || "") || today();
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
      setPdfInvoiceForm(defaultInvoiceForm());
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      const client_id = validateRequired(createInvoiceForm.client_id, "Cliente");
      const invoice_number = validateRequired(
        createInvoiceForm.invoice_number,
        "Número",
      );
      const amount = validatePositiveAmount(createInvoiceForm.amount);

      createMut.mutate({
        client_id,
        mandate_id: null,
        invoice_number,
        issue_date: createInvoiceForm.issue_date,
        due_date: validateRequired(createInvoiceForm.due_date, "Vencimiento"),
        amount,
        concept: normalizeNullable(createInvoiceForm.concept),
        payment_method: createInvoiceForm.payment_method,
        payment_status: createInvoiceForm.payment_status,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear factura");
    }
  }

  function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingInvoice) return;

    try {
      const client_id = validateRequired(editInvoiceForm.client_id, "Cliente");
      const invoice_number = validateRequired(editInvoiceForm.invoice_number, "Número");
      const amount = validatePositiveAmount(editInvoiceForm.amount);

      updateInvoiceMut.mutate({
        id: editingInvoice.id,
        client_id,
        invoice_number,
        issue_date: editInvoiceForm.issue_date,
        due_date: validateRequired(editInvoiceForm.due_date, "Vencimiento"),
        amount,
        concept: normalizeNullable(editInvoiceForm.concept),
        payment_method: editInvoiceForm.payment_method,
        payment_status: editInvoiceForm.payment_status,
        existing_paid_at: editingInvoice.paid_at,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al actualizar factura",
      );
    }
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

    try {
      const client_id = validateRequired(pdfInvoiceForm.client_id, "Cliente");
      const invoice_number = validateRequired(pdfInvoiceForm.invoice_number, "Número");
      const amount = validatePositiveAmount(pdfInvoiceForm.amount);

      importPdfMut.mutate({
        file: pdfFile,
        client_id,
        invoice_number,
        issue_date: pdfInvoiceForm.issue_date,
        due_date: validateRequired(pdfInvoiceForm.due_date, "Vencimiento"),
        amount,
        concept: normalizeNullable(pdfInvoiceForm.concept),
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al importar factura PDF",
      );
    }
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
                <Select
                  value={editInvoiceForm.client_id}
                  onValueChange={(v) =>
                    setEditInvoiceForm((p) => ({ ...p, client_id: v }))
                  }
                >
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
                    value={editInvoiceForm.invoice_number}
                    onChange={(e) =>
                      setEditInvoiceForm((p) => ({
                        ...p,
                        invoice_number: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Importe (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editInvoiceForm.amount}
                    onChange={(e) =>
                      setEditInvoiceForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Emisión</Label>
                  <Input
                    type="date"
                    value={editInvoiceForm.issue_date}
                    onChange={(e) =>
                      setEditInvoiceForm((p) => ({
                        ...p,
                        issue_date: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vencimiento *</Label>
                  <Input
                    type="date"
                    value={editInvoiceForm.due_date}
                    onChange={(e) =>
                      setEditInvoiceForm((p) => ({
                        ...p,
                        due_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Concepto</Label>
                <Input
                  value={editInvoiceForm.concept}
                  onChange={(e) =>
                    setEditInvoiceForm((p) => ({ ...p, concept: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select
                  value={editInvoiceForm.payment_method}
                  onValueChange={(v) =>
                    setEditInvoiceForm((p) => ({
                      ...p,
                      payment_method: v as PaymentMethod,
                    }))
                  }
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
                  value={editInvoiceForm.payment_status}
                  onValueChange={(v) =>
                    setEditInvoiceForm((p) => ({
                      ...p,
                      payment_status: v as PaymentStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
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
            if (!next) {
              setPdfFile(null);
              setPdfInvoiceForm(defaultInvoiceForm());
            }
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
                <Select
                  value={pdfInvoiceForm.client_id}
                  onValueChange={(v) =>
                    setPdfInvoiceForm((p) => ({ ...p, client_id: v }))
                  }
                >
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
                    value={pdfInvoiceForm.invoice_number}
                    onChange={(e) =>
                      setPdfInvoiceForm((p) => ({
                        ...p,
                        invoice_number: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Importe (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pdfInvoiceForm.amount}
                    onChange={(e) =>
                      setPdfInvoiceForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Emisión</Label>
                  <Input
                    type="date"
                    value={pdfInvoiceForm.issue_date}
                    onChange={(e) =>
                      setPdfInvoiceForm((p) => ({
                        ...p,
                        issue_date: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vencimiento *</Label>
                  <Input
                    type="date"
                    value={pdfInvoiceForm.due_date}
                    onChange={(e) =>
                      setPdfInvoiceForm((p) => ({
                        ...p,
                        due_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Concepto</Label>
                <Input
                  value={pdfInvoiceForm.concept}
                  onChange={(e) =>
                    setPdfInvoiceForm((p) => ({ ...p, concept: e.target.value }))
                  }
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={importPdfMut.isPending}>
                  Crear factura
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setCreateInvoiceForm(defaultInvoiceForm());
          }}
        >
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
                <Select
                  value={createInvoiceForm.client_id}
                  onValueChange={(v) =>
                    setCreateInvoiceForm((p) => ({ ...p, client_id: v }))
                  }
                >
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
                    value={createInvoiceForm.invoice_number}
                    onChange={(e) =>
                      setCreateInvoiceForm((p) => ({
                        ...p,
                        invoice_number: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Importe (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={createInvoiceForm.amount}
                    onChange={(e) =>
                      setCreateInvoiceForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Emisión</Label>
                  <Input
                    type="date"
                    value={createInvoiceForm.issue_date}
                    onChange={(e) =>
                      setCreateInvoiceForm((p) => ({
                        ...p,
                        issue_date: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Vencimiento *</Label>
                  <Input
                    type="date"
                    value={createInvoiceForm.due_date}
                    onChange={(e) =>
                      setCreateInvoiceForm((p) => ({
                        ...p,
                        due_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Concepto</Label>
                <Input
                  value={createInvoiceForm.concept}
                  onChange={(e) =>
                    setCreateInvoiceForm((p) => ({ ...p, concept: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select
                  value={createInvoiceForm.payment_method}
                  onValueChange={(v) =>
                    setCreateInvoiceForm((p) => ({
                      ...p,
                      payment_method: v as PaymentMethod,
                    }))
                  }
                >
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
                <Select
                  value={createInvoiceForm.payment_status}
                  onValueChange={(v) =>
                    setCreateInvoiceForm((p) => ({
                      ...p,
                      payment_status: v as PaymentStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
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
                        !canEdit ||
                        updatePaymentMethodMut.isPending ||
                        toggleStatusMut.isPending
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
                          ? "Pagada"
                          : inv.status === "included"
                            ? "En remesa"
                            : "Pendiente"}
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

  const pending = invoices.filter(
    (i) => i.payment_status === "pending" && i.status !== "included",
  );

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
      status: RemittanceStatus;
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
                          if (
                            confirm(
                              "¿Eliminar remesa? Las facturas volverán a pendientes.",
                            )
                          ) {
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