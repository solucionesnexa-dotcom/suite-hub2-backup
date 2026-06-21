import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/useCanEdit";
import { db } from "@/lib/nexa";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/usuarios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Usuarios · Nexa Suite" }] }),
  component: UsersPage,
});

function UsersPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["users-admin"],
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id, email, full_name, apellidos, rol_global, activo, ultimo_acceso")
        .order("email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, rol_global }: { id: string; rol_global: string }) => {
      const { error } = await db.from("profiles").update({ rol_global }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-admin"] });
      toast.success("Rol actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Usuarios">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios del sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isAdmin && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Solo los administradores pueden modificar roles.
              </p>
            )}
            {users.length === 0 && <p className="text-sm text-muted-foreground">Sin usuarios visibles.</p>}
            {users.map((u: any) => (
              <div key={u.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_140px_180px]">
                <div>
                  <div className="font-medium">{u.full_name || u.email}</div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                </div>
                <Badge variant={u.activo ? "secondary" : "destructive"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                <Select
                  value={u.rol_global}
                  disabled={!isAdmin || updateMut.isPending}
                  onValueChange={(rol_global) => updateMut.mutate({ id: u.id, rol_global })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button variant="outline" disabled>
              Invitar usuario
            </Button>
            <p className="text-xs text-muted-foreground">
              Las invitaciones requieren configurar el flujo de Supabase Auth/Admin en producción.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
