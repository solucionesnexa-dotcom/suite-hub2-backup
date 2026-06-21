import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useCanEdit } from "@/hooks/useCanEdit";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isValidIban, formatIban } from "@/lib/iban";

export const Route = createFileRoute("/_authenticated/clients")({
  ssr: false,
  head: () => ({ meta: [{ title: "Clientes · Nexa Suite" }] }),
  component: ClientsPage,
});

type Client = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  created_at: string;
};

function ClientsPage() {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const canEdit = useCanEdit();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, tax_id, email, phone, iban, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload: Partial<Client> & { name: string }) => {
      if (!ws) throw new Error("Sin workspace");
      const iban = payload.iban ? payload.iban.replace(/\s+/g, "").toUpperCase() : null;
      const { error } = await supabase.from("clients").insert({
        workspace_id: ws.id,
        name: payload.name,
        tax_id: payload.tax_id ?? null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        iban,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente creado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente eliminado");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = clients.filter((c) =>
    !q
      ? true
      : (c.name + " " + (c.tax_id ?? "") + " " + (c.email ?? ""))
          .toLowerCase()
          .includes(q.toLowerCase()),
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return toast.error("El nombre es obligatorio");
    const iban = String(fd.get("iban") ?? "").trim();
    if (iban && !isValidIban(iban)) return toast.error("IBAN no válido");
    createMut.mutate({
      name,
      tax_id: String(fd.get("tax_id") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim() || null,
      phone: String(fd.get("phone") ?? "").trim() || null,
      iban: iban || null,
    });
  }

  return (
    <AppShell title="Clientes">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Clientes</h2>
            <p className="text-sm text-muted-foreground">
              Pymes, clínicas y despachos que gestionas.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canEdit}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nombre / Razón social *</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tax_id">NIF / CIF</Label>
                    <Input id="tax_id" name="tax_id" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" name="phone" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    name="iban"
                    placeholder="ES91 2100 0418 4502 0005 1332"
                    className="font-mono"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending}>
                    Guardar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente..."
            className="pl-9"
          />
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Sin clientes todavía.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      to="/clients/$id"
                      params={{ id: c.id }}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.tax_id ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.iban ? formatIban(c.iban) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canEdit}
                      onClick={() => {
                        if (confirm(`¿Eliminar ${c.name}?`)) deleteMut.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}

// keep import to avoid TS warning when Textarea is unused
void Textarea;
