import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { isValidIban } from "@/lib/iban";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configuración · Nexa Suite" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useProfile();

  if (profile && profile.rol_global === "viewer") {
    return (
      <AppShell title="Configuración">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No tienes permiso para acceder a la configuración.
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Configuración">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Configuración</h2>
          <p className="text-sm text-muted-foreground">Datos de tu agencia, cuentas bancarias emisoras y tu cuenta personal.</p>
        </div>
        <Tabs defaultValue="company">
          <TabsList>
            <TabsTrigger value="company">Mi empresa</TabsTrigger>
            <TabsTrigger value="banks">Cuentas bancarias</TabsTrigger>
            <TabsTrigger value="users">Usuarios</TabsTrigger>
            <TabsTrigger value="account">Mi cuenta</TabsTrigger>
          </TabsList>
          <TabsContent value="company"><CompanyTab /></TabsContent>
          <TabsContent value="banks"><BanksTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="account"><AccountTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function CompanyTab() {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();

  const { data: company } = useQuery({
    queryKey: ["company-settings", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("workspace_id", ws!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    razon_social: "", cif: "", direccion: "", ciudad: "", provincia: "",
    pais: "ES", codigo_postal: "", telefono: "", email: "", web: "",
    logo_url: "", color_marca: "",
  });

  useEffect(() => {
    if (company) {
      setForm({
        razon_social: company.razon_social ?? "",
        cif: company.cif ?? "", direccion: company.direccion ?? "",
        ciudad: company.ciudad ?? "", provincia: company.provincia ?? "",
        pais: company.pais ?? "ES", codigo_postal: company.codigo_postal ?? "",
        telefono: company.telefono ?? "", email: company.email ?? "",
        web: company.web ?? "", logo_url: company.logo_url ?? "",
        color_marca: company.color_marca ?? "",
      });
    }
  }, [company]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("Sin workspace");
      if (!form.razon_social.trim()) throw new Error("La razón social es obligatoria");
      const payload = { ...form, workspace_id: ws.id };
      const { error } = await supabase
        .from("company_settings")
        .upsert(payload, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Datos guardados");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Datos de la empresa</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Razón social *"><Input value={form.razon_social} onChange={set("razon_social")} /></Field>
          <Field label="CIF"><Input value={form.cif} onChange={set("cif")} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Teléfono"><Input value={form.telefono} onChange={set("telefono")} /></Field>
          <Field label="Web"><Input value={form.web} onChange={set("web")} placeholder="https://..." /></Field>
          <Field label="Color de marca"><Input type="color" value={form.color_marca || "#000000"} onChange={set("color_marca")} className="h-10 w-20 p-1" /></Field>
        </div>
        <Field label="Dirección"><Input value={form.direccion} onChange={set("direccion")} /></Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="CP"><Input value={form.codigo_postal} onChange={set("codigo_postal")} /></Field>
          <Field label="Ciudad"><Input value={form.ciudad} onChange={set("ciudad")} /></Field>
          <Field label="Provincia"><Input value={form.provincia} onChange={set("provincia")} /></Field>
          <Field label="País"><Input value={form.pais} onChange={set("pais")} /></Field>
        </div>
        <Field label="URL del logo"><Input value={form.logo_url} onChange={set("logo_url")} placeholder="https://..." /></Field>
        <div className="flex justify-end">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Guardar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BanksTab() {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const [open, setOpen] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["company-bank-accounts", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_bank_accounts")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (p: { alias: string; iban: string; bic: string; sepa_creditor_name: string; sepa_creditor_id: string; is_default: boolean }) => {
      if (!ws) throw new Error("Sin workspace");
      if (!isValidIban(p.iban)) throw new Error("IBAN no válido");
      if (p.is_default) {
        await supabase.from("company_bank_accounts").update({ is_default: false }).eq("workspace_id", ws.id);
      }
      const { error } = await supabase.from("company_bank_accounts").insert({
        workspace_id: ws.id,
        alias: p.alias,
        iban: p.iban.replace(/\s+/g, "").toUpperCase(),
        bic: p.bic || null,
        sepa_creditor_name: p.sepa_creditor_name,
        sepa_creditor_id: p.sepa_creditor_id,
        is_default: p.is_default,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cuenta añadida");
      qc.invalidateQueries({ queryKey: ["company-bank-accounts"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const defaultMut = useMutation({
    mutationFn: async (id: string) => {
      if (!ws) return;
      await supabase.from("company_bank_accounts").update({ is_default: false }).eq("workspace_id", ws.id);
      const { error } = await supabase.from("company_bank_accounts").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-bank-accounts"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-bank-accounts"] }),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMut.mutate({
      alias: String(fd.get("alias") ?? ""),
      iban: String(fd.get("iban") ?? ""),
      bic: String(fd.get("bic") ?? ""),
      sepa_creditor_name: String(fd.get("creditor_name") ?? ""),
      sepa_creditor_id: String(fd.get("creditor_id") ?? ""),
      is_default: fd.get("is_default") === "on",
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Cuentas bancarias emisoras</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Añadir cuenta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva cuenta bancaria</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <Field label="Alias *"><Input name="alias" required placeholder="Cuenta principal Santander" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="IBAN *"><Input name="iban" required className="font-mono" placeholder="ES91..." /></Field>
                <Field label="BIC"><Input name="bic" className="font-mono" /></Field>
              </div>
              <Field label="Nombre acreedor SEPA *"><Input name="creditor_name" required /></Field>
              <Field label="ID acreedor SEPA *"><Input name="creditor_id" required placeholder="ESxxZZZxxxxxxxxx" /></Field>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="is_default" /> Marcar como predeterminada
              </label>
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alias</TableHead><TableHead>IBAN</TableHead>
              <TableHead>Acreedor</TableHead><TableHead>Creditor ID</TableHead>
              <TableHead></TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Sin cuentas. Añade una para generar remesas.</TableCell></TableRow>
            )}
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.alias} {a.is_default && <Badge variant="secondary" className="ml-2">Predet.</Badge>}</TableCell>
                <TableCell className="font-mono text-xs">{a.iban}</TableCell>
                <TableCell>{a.sepa_creditor_name}</TableCell>
                <TableCell className="font-mono text-xs">{a.sepa_creditor_id}</TableCell>
                <TableCell>
                  {!a.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => defaultMut.mutate(a.id)}>
                      <Star className="mr-1 h-3 w-3" /> Predet.
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar cuenta?")) deleteMut.mutate(a.id); }}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
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

function AccountTab() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: ws } = useCurrentWorkspace();
  const roleLabels = { admin: "Admin", consultor: "Consultor", viewer: "Viewer" } as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Mi cuenta</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Info label="Email" value={user?.email} />
          <Info label="Nombre" value={profile?.full_name ?? user?.user_metadata?.full_name ?? "—"} />
          <Info label="Apellidos" value={profile?.apellidos ?? "—"} />
          <Info label="Rol global" value={profile ? <Badge>{roleLabels[profile.rol_global]}</Badge> : "—"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Info label="Nombre" value={ws?.name ?? "—"} />
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: ws } = useCurrentWorkspace();
  const [open, setOpen] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["workspace-users", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, rol_global, created_at")
        .eq("workspace_id", ws!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const removeUserMut = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ workspace_id: null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuario removido del workspace");
      qc.invalidateQueries({ queryKey: ["workspace-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isAdmin = profile?.rol_global === "admin";
  const roleLabels = { admin: "Admin", consultor: "Consultor", viewer: "Viewer" } as const;

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Solo los administradores pueden gestionar usuarios.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Usuarios del workspace</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Invitar usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
            <InviteUserForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Sin usuarios en este workspace.</TableCell></TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>{u.full_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{roleLabels[u.rol_global]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.created_at?.slice(0, 10)}</TableCell>
                <TableCell className="text-right">
                  {u.id !== profile?.id && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        if (confirm(`¿Remover a ${u.full_name || u.email}?`)) {
                          removeUserMut.mutate(u.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InviteUserForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: ws } = useCurrentWorkspace();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!ws) throw new Error("Sin workspace");
      
      // Check if user exists by email
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const user = existingUser?.users?.find((u) => u.email === email);
      
      if (!user) {
        return toast.error("Usuario no encontrado en el sistema");
      }

      // Add user to workspace
      const { error } = await supabase
        .from("profiles")
        .update({ workspace_id: ws.id })
        .eq("id", user.id);
      
      if (error) throw error;
      
      toast.success(`${email} añadido al workspace`);
      qc.invalidateQueries({ queryKey: ["workspace-users"] });
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al invitar usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email del usuario *</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@ejemplo.com"
          required
        />
        <p className="text-xs text-muted-foreground">El usuario debe estar registrado en el sistema.</p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>Invitar</Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
