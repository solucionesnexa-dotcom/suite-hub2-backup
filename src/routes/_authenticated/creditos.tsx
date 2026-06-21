import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PaginationBar } from "@/components/PaginationBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useProfile } from "@/hooks/useProfile";
import { addCredits, db, getCreditBalance } from "@/lib/nexa";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creditos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Creditos · Nexa Suite" }] }),
  component: CreditsPage,
});

function CreditsPage() {
  const { data: ws } = useCurrentWorkspace();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);

  const { data: balance = 0 } = useQuery({
    queryKey: ["credit-balance", ws?.id],
    enabled: !!ws,
    queryFn: () => getCreditBalance(ws!.id),
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["credit-movements", ws?.id, page],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await db
        .from("credit_movements")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMut = useMutation({
    mutationFn: async (amount: number) => {
      if (!ws) throw new Error("Sin workspace");
      return addCredits(ws.id, amount, "Recarga manual");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-balance"] });
      qc.invalidateQueries({ queryKey: ["credit-movements"] });
      toast.success("Creditos anadidos");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Creditos">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <div className="text-sm text-muted-foreground">Saldo actual del workspace</div>
              <div className="mt-1 text-4xl font-semibold">{balance}</div>
            </div>
            <Badge variant={balance < 5 ? "destructive" : "secondary"}>{balance < 5 ? "Saldo bajo" : "Saldo OK"}</Badge>
          </CardContent>
        </Card>

        {profile?.rol_global === "admin" && (
          <Card>
            <CardHeader><CardTitle>Panel admin</CardTitle></CardHeader>
            <CardContent>
              <form
                className="flex max-w-sm items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const amount = Number(new FormData(e.currentTarget).get("amount"));
                  if (amount > 0) addMut.mutate(amount);
                  e.currentTarget.reset();
                }}
              >
                <div className="flex-1 space-y-2">
                  <Label>Creditos a anadir</Label>
                  <Input name="amount" type="number" min={1} defaultValue={10} />
                </div>
                <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Anadir</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Historico de movimientos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {movements.length === 0 && <p className="text-sm text-muted-foreground">Sin movimientos todavia.</p>}
            {movements.map((m: any) => (
              <div key={m.id} className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-[1fr_140px_120px_120px]">
                <div>
                  <div className="font-medium">{m.module} · {m.action}</div>
                  <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("es-ES")}</div>
                </div>
                <div>Delta: <span className={m.delta < 0 ? "text-destructive" : "text-green-600"}>{m.delta}</span></div>
                <div>Saldo: {m.balance_after}</div>
              </div>
            ))}
            <PaginationBar page={page} count={movements.length} onPageChange={setPage} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
