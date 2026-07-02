import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/nexa";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ajustes · Nexa Suite" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: ws } = useCurrentWorkspace();
  const qc = useQueryClient();

  const { data: role } = useQuery({
    queryKey: ["my-role", ws?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("workspace_id", ws!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role ?? null;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db
        .from("company_settings")
        .select("*")
        .eq("workspace_id", ws!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveSettingsMut = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!ws) throw new Error("Sin workspace");
      const payload = {
        workspace_id: ws.id,
        legal_name: String(fd.get("legal_name") ?? "") || null,
        trade_name: String(fd.get("trade_name") ?? "") || null,
        tax_id: String(fd.get("tax_id") ?? "") || null,
        email: String(fd.get("email") ?? "") || null,
        phone: String(fd.get("phone") ?? "") || null,
        address: String(fd.get("address") ?? "") || null,
      };
      const { error } = await db.from("company_settings").upsert(payload, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Configuracion guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Ajustes">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Mi cuenta</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="font-medium">{user?.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Nombre</div>
              <div>{user?.user_metadata?.full_name ?? "—"}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Nombre</div>
              <div className="font-medium">{ws?.name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tu rol</div>
              <div>
                <Badge variant="secondary">{role ?? "—"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Empresa e IA</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              key={settings?.id ?? "empty"}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveSettingsMut.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Razon social" name="legal_name" defaultValue={settings?.legal_name} />
                <Field label="Nombre comercial" name="trade_name" defaultValue={settings?.trade_name} />
                <Field label="NIF" name="tax_id" defaultValue={settings?.tax_id} />
                <Field label="Email" name="email" defaultValue={settings?.email} />
                <Field label="Telefono" name="phone" defaultValue={settings?.phone} />
                <Field label="Direccion" name="address" defaultValue={settings?.address} />
              </div>
              <p className="text-xs text-muted-foreground">
                Las claves de IA (OpenAI/Anthropic) se gestionan mediante variables de entorno del servidor por seguridad. Contacta con el administrador para configurarlas.
              </p>
              <Button type="submit" disabled={saveSettingsMut.isPending}>Guardar configuracion</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input name={name} defaultValue={defaultValue ?? ""} />
    </div>
  );
}
