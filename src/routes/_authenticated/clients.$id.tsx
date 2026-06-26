import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .maybeSingle();

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

  const createMandate = useMutation({
    mutationFn: async (m: {
      mandate_reference: string;
      iban: string;
      bic: string | null;
      debtor_name: string;
      signature_date: string;
    }) => {
      const workspaceId = ws?.id;

      if (!workspaceId) {
        throw new Error("Workspace no disponible al guardar el mandato SEPA");
      }

      const { error } = await supabase.from("sepa_mandates").insert({
        workspace_id: workspaceId,
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
      setOpen(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const deleteMandate = useMutation({
    mutationFn: async (mid: string) => {
      const { error } = await supabase.from("sepa_mandates").delete().eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mandates", id] });
      toast.success("Mandato eliminado");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const iban = String(fd.get("iban") ?? "").trim();

    if (!isValidIban(iban)) {
      return toast.error("IBAN no válido");
    }

    createMandate.mutate({
      mandate_reference: String(fd.get("mandate_reference") ?? "").trim(),
      iban,
      bic: String(fd.get("bic") ?? "").trim() || null,
      debtor_name: String(fd.get("debtor_name") ?? "").trim() || client?.name || "",
      signature_date: String(fd.get("signature_date") ?? "").trim(),
    });
  }

  return (
    <AppShell title={client?.name ?? "Cliente"}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          to="/clients"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Volver a clientes
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Nombre</div>
              <div className="font-medium">{client?.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">NIF</div>
              <div>{client?.tax_id ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div>{client?.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Teléfono</div>
              <div>{client?.phone ?? "—"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground">IBAN</div>
              <div className="font-mono">{client?.iban ? formatIban(client.iban) : "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mandatos SEPA</CardTitle>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo mandato
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo mandato SEPA</DialogTitle>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mandate_reference">Referencia mandato *</Label>
                    <Input
                      id="mandate_reference"
                      name="mandate_reference"
                      required
                      maxLength={35}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="debtor_name">Nombre del deudor</Label>
                    <Input
                      id="debtor_name"
                      name="debtor_name"
                      defaultValue={client?.name ?? ""}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="iban">IBAN *</Label>
                    <Input
                      id="iban"
                      name="iban"
                      required
                      defaultValue={client?.iban ?? ""}
                      className="font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="bic">BIC</Label>
                      <Input
                        id="bic"
                        name="bic"
                        defaultValue={client?.bic ?? ""}
                        className="font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signature_date">Fecha firma *</Label>
                      <Input id="signature_date" name="signature_date" type="date" required />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={createMandate.isPending}>
                      Guardar
                    </Button>
                  </DialogFooter>
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
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Sin mandatos.
                    </TableCell>
                  </TableRow>
                )}

                {mandates.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.mandate_reference}</TableCell>
                    <TableCell className="font-mono text-xs">{formatIban(m.iban)}</TableCell>
                    <TableCell>{m.signature_date}</TableCell>
                    <TableCell>{m.sequence_type}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("¿Eliminar mandato?")) {
                            deleteMandate.mutate(m.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
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