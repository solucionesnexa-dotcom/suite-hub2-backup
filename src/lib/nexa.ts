import { supabase } from "@/integrations/supabase/client";

export const db = supabase as any;

export type ClientOption = {
  id: string;
  name: string;
  sector?: string | null;
  status?: string | null;
};

export const pipelineColumns = [
  { value: "prospecto", label: "Prospecto" },
  { value: "diagnostico", label: "Diagnostico" },
  { value: "propuesta_enviada", label: "Propuesta enviada" },
  { value: "negociacion", label: "Negociacion" },
  { value: "cerrado", label: "Cerrado" },
  { value: "retainer_activo", label: "Retainer activo" },
  { value: "pausado", label: "Pausado" },
  { value: "perdido", label: "Perdido" },
] as const;

export const serviceCatalog = [
  { descripcion: "Automatizacion basica", tipo: "servicio_unico", importe: 150 },
  { descripcion: "Automatizacion media", tipo: "servicio_unico", importe: 600 },
  { descripcion: "Implantacion completa", tipo: "servicio_unico", importe: 1500 },
  { descripcion: "Retainer mensual basico", tipo: "retainer", importe: 150 },
  { descripcion: "Retainer mensual avanzado", tipo: "retainer", importe: 300 },
  { descripcion: "Auditoria de procesos", tipo: "servicio_unico", importe: 250 },
  { descripcion: "SOP de proceso", tipo: "servicio_unico", importe: 150 },
  { descripcion: "Diagnostico digital + PDF", tipo: "servicio_unico", importe: 99 },
  { descripcion: "Kit Digital - Fase 1", tipo: "otro", importe: 0 },
] as const;

export function eur(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function daysSince(value?: string | null) {
  if (!value) return Infinity;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

export function downloadTextFile(filename: string, content: string, type = "text/html") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function renderOnePager(title: string, body: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #0f172a; margin: 40px; }
    h1 { color: #2563eb; margin-bottom: 8px; }
    h2 { margin-top: 28px; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    .muted { color: #64748b; }
    .total { font-size: 22px; font-weight: 700; color: #0f766e; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="muted">Nexa Suite · Documento generado para uso comercial</p>
  ${body}
</body>
</html>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function getCreditBalance(workspaceId: string) {
  const { data, error } = await db
    .from("credit_accounts")
    .select("balance")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (data) return Number(data.balance ?? 0);
  const { data: created, error: createError } = await db
    .from("credit_accounts")
    .insert({ workspace_id: workspaceId, balance: 20 })
    .select("balance")
    .single();
  if (createError) throw createError;
  return Number(created.balance ?? 0);
}

export async function spendCredits(workspaceId: string, module: string, action: string, amount: number) {
  const balance = await getCreditBalance(workspaceId);
  if (balance < amount) throw new Error("No hay saldo de creditos suficiente");
  const next = balance - amount;
  const { error: updateError } = await db
    .from("credit_accounts")
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId);
  if (updateError) throw updateError;
  const { data: userRes } = await supabase.auth.getUser();
  const { error: movementError } = await db.from("credit_movements").insert({
    workspace_id: workspaceId,
    module,
    action,
    delta: -amount,
    balance_after: next,
    created_by: userRes.user?.id ?? null,
  });
  if (movementError) throw movementError;
  return next;
}

export async function addCredits(workspaceId: string, amount: number, reason = "Ajuste manual") {
  const balance = await getCreditBalance(workspaceId);
  const next = balance + amount;
  const { error: updateError } = await db
    .from("credit_accounts")
    .upsert({ workspace_id: workspaceId, balance: next, updated_at: new Date().toISOString() });
  if (updateError) throw updateError;
  const { data: userRes } = await supabase.auth.getUser();
  const { error: movementError } = await db.from("credit_movements").insert({
    workspace_id: workspaceId,
    module: "creditos",
    action: reason,
    delta: amount,
    balance_after: next,
    created_by: userRes.user?.id ?? null,
  });
  if (movementError) throw movementError;
  return next;
}
