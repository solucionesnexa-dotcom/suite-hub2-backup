import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ajustes · Nexa Suite" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: ws } = useCurrentWorkspace();

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

  return (
    <AppShell title="Ajustes">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Mi cuenta</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><div className="text-xs text-muted-foreground">Email</div><div className="font-medium">{user?.email}</div></div>
            <div><div className="text-xs text-muted-foreground">Nombre</div><div>{user?.user_metadata?.full_name ?? "—"}</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Workspace</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><div className="text-xs text-muted-foreground">Nombre</div><div className="font-medium">{ws?.name ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Tu rol</div><div><Badge variant="secondary">{role ?? "—"}</Badge></div></div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
