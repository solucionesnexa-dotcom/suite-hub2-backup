import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, Sparkles, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractInvoiceFromPdf, type ExtractedInvoiceData } from "@/lib/pdf-extract.functions";

type Row = {
  filename: string;
  status: "pending" | "extracting" | "ready" | "error";
  error?: string;
  client_id: string;
  new_client_name: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: string;
  concept: string;
  saas_origen: string;
  data?: ExtractedInvoiceData;
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const today = () => new Date().toISOString().slice(0, 10);

export function PdfImportDialog({
  workspaceId,
  clients,
  onImported,
}: {
  workspaceId: string | undefined;
  clients: Array<{ id: string; name: string }>;
  onImported?: () => void;
}) {
  const qc = useQueryClient();
  const extractFn = useServerFn(extractInvoiceFromPdf);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setRows([]);
    setBusy(false);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      toast.error("Selecciona archivos PDF");
      return;
    }
    setBusy(true);
    const newRows: Row[] = pdfs.map((f) => ({
      filename: f.name,
      status: "extracting",
      client_id: "",
      new_client_name: "",
      invoice_number: "",
      issue_date: today(),
      due_date: today(),
      amount: "",
      concept: "",
      saas_origen: "",
    }));
    setRows((r) => [...r, ...newRows]);
    const startIdx = rows.length;

    await Promise.all(
      pdfs.map(async (file, i) => {
        try {
          const pdfBase64 = await fileToBase64(file);
          const data = await extractFn({ data: { filename: file.name, pdfBase64 } });
          const matched = clients.find(
            (c) => data.client_name && c.name.trim().toLowerCase() === data.client_name.trim().toLowerCase(),
          );
          setRows((prev) => {
            const next = [...prev];
            next[startIdx + i] = {
              ...next[startIdx + i],
              status: "ready",
              data,
              client_id: matched?.id ?? "",
              new_client_name: matched ? "" : data.client_name ?? "",
              invoice_number: data.invoice_number ?? "",
              issue_date: data.issue_date ?? today(),
              due_date: data.due_date ?? data.issue_date ?? today(),
              amount: data.amount != null ? String(data.amount) : "",
              concept: data.concept ?? "",
              saas_origen: data.saas_origen ?? "",
            };
            return next;
          });
        } catch (e) {
          setRows((prev) => {
            const next = [...prev];
            next[startIdx + i] = {
              ...next[startIdx + i],
              status: "error",
              error: e instanceof Error ? e.message : "Error al procesar",
            };
            return next;
          });
        }
      }),
    );
    setBusy(false);
  }

  const importMut = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Sin workspace");
      const ready = rows.filter((r) => r.status === "ready");
      if (!ready.length) throw new Error("Nada que importar");
      let createdClients = 0;
      const clientNameToId = new Map(clients.map((c) => [c.name.toLowerCase(), c.id]));
      const inserts = [];
      const errors: string[] = [];
      for (const r of ready) {
        let client_id = r.client_id;
        if (!client_id && r.new_client_name.trim()) {
          const key = r.new_client_name.trim().toLowerCase();
          const existing = clientNameToId.get(key);
          if (existing) {
            client_id = existing;
          } else {
            const { data: newClient, error } = await supabase
              .from("clients")
              .insert({ workspace_id: workspaceId, name: r.new_client_name.trim(), nif: r.data?.client_nif ?? null })
              .select("id")
              .single();
            if (error) {
              errors.push(`${r.filename}: ${error.message}`);
              continue;
            }
            client_id = newClient.id;
            clientNameToId.set(key, client_id);
            createdClients += 1;
          }
        }
        if (!client_id) {
          errors.push(`${r.filename}: falta cliente`);
          continue;
        }
        const amount = Number(r.amount);
        if (!isFinite(amount) || amount <= 0) {
          errors.push(`${r.filename}: importe inválido`);
          continue;
        }
        if (!r.invoice_number.trim()) {
          errors.push(`${r.filename}: falta número`);
          continue;
        }
        inserts.push({
          workspace_id: workspaceId,
          client_id,
          invoice_number: r.invoice_number.trim(),
          amount,
          issue_date: r.issue_date,
          due_date: r.due_date,
          concept: r.concept || null,
          source: r.saas_origen || "pdf",
          status: "pending" as const,
        });
      }
      if (!inserts.length) throw new Error(errors[0] || "Nada que importar");
      const { error } = await supabase.from("invoices").insert(inserts);
      if (error) throw error;
      return { inserted: inserts.length, createdClients, errors };
    },
    onSuccess: (res) => {
      toast.success(`${res.inserted} facturas importadas${res.createdClients ? ` · ${res.createdClients} clientes nuevos` : ""}`);
      if (res.errors.length) toast.warning(`${res.errors.length} con errores`);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["clients-lite"] });
      onImported?.();
      reset();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" /> Importar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importar facturas desde PDF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground hover:bg-muted/50">
            <Upload className="h-4 w-4" />
            <span>Selecciona uno o varios PDFs (la IA extraerá los datos)</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </label>

          {rows.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Archivo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="w-32">Número</TableHead>
                    <TableHead className="w-36">Vencimiento</TableHead>
                    <TableHead className="w-28 text-right">Importe</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2 text-xs">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate" title={r.filename}>{r.filename}</span>
                        </div>
                        {r.status === "extracting" && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Extrayendo…
                          </div>
                        )}
                        {r.status === "error" && (
                          <div className="mt-1 text-[11px] text-destructive">{r.error}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.status === "ready" ? (
                          <div className="space-y-1">
                            <Select
                              value={r.client_id || "__new__"}
                              onValueChange={(v) =>
                                setRows((prev) => {
                                  const next = [...prev];
                                  next[i] = { ...next[i], client_id: v === "__new__" ? "" : v };
                                  return next;
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__new__">+ Crear nuevo</SelectItem>
                                {clients.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!r.client_id && (
                              <Input
                                className="h-8 text-xs"
                                placeholder="Nombre del nuevo cliente"
                                value={r.new_client_name}
                                onChange={(e) =>
                                  setRows((prev) => {
                                    const next = [...prev];
                                    next[i] = { ...next[i], new_client_name: e.target.value };
                                    return next;
                                  })
                                }
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 text-xs"
                          disabled={r.status !== "ready"}
                          value={r.invoice_number}
                          onChange={(e) =>
                            setRows((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], invoice_number: e.target.value };
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          disabled={r.status !== "ready"}
                          value={r.due_date}
                          onChange={(e) =>
                            setRows((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], due_date: e.target.value };
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 text-right text-xs"
                          disabled={r.status !== "ready"}
                          value={r.amount}
                          onChange={(e) =>
                            setRows((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], amount: e.target.value };
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Label className="mr-auto text-xs text-muted-foreground">
            {rows.filter((r) => r.status === "ready").length} listas · {rows.filter((r) => r.status === "extracting").length} procesando · {rows.filter((r) => r.status === "error").length} con error
          </Label>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => importMut.mutate()}
            disabled={busy || importMut.isPending || !rows.some((r) => r.status === "ready")}
          >
            {importMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar {rows.filter((r) => r.status === "ready").length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
