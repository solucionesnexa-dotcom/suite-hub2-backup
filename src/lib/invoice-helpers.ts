// Helper functions for invoice management
import { supabase } from "@/integrations/supabase/client";

export type InvoiceStatus = "pending" | "included" | "paid" | "returned";

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  pending: "Pendiente",
  included: "Remesada",
  paid: "Cobrada",
  returned: "Devuelta",
};

export const invoiceStatusColors: Record<InvoiceStatus, string> = {
  pending: "outline",
  included: "secondary",
  paid: "default",
  returned: "destructive",
};

/**
 * Get mandate status for a client
 */
export async function getClientMandateStatus(clientId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("sepa_mandates")
    .select("id")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Validate invoices have required mandate before remittance
 */
export async function validateInvoicesForRemittance(
  invoiceIds: string[],
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_id")
    .in("id", invoiceIds);

  if (invError || !invoices) return { valid: false, issues: ["Error fetching invoices"] };

  for (const inv of invoices) {
    const hasMandateStatus = await getClientMandateStatus(inv.client_id);
    if (!hasMandateStatus) {
      issues.push(`Factura ${inv.invoice_number}: cliente sin mandato SEPA activo`);
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Calculate invoice statistics
 */
export async function getInvoiceStats(workspaceId: string): Promise<{
  totalPending: number;
  totalAmount: number;
  monthlyRemittances: number;
}> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [pendingRes, amountRes, remitRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending"),
    supabase
      .from("invoices")
      .select("amount")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending"),
    supabase
      .from("remittances")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", monthStart),
  ]);

  const totalAmount = (amountRes.data ?? []).reduce((sum, inv) => sum + Number(inv.amount), 0);

  return {
    totalPending: pendingRes.count ?? 0,
    totalAmount,
    monthlyRemittances: remitRes.count ?? 0,
  };
}
