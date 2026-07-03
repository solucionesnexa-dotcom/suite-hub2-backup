import { supabase } from "@/integrations/supabase/client";

export const db = supabase as any;

export type ClientOption = {
  id: string;
  name: string;
  sector?: string | null;
  status?: string | null;
};

export type CompanySettings = {
  legal_name?: string | null;
  trade_name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
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

export function downloadPdfFile(filename: string, title: string, htmlBody: string, company?: CompanySettings | null) {
  const text = htmlToPlainText(htmlBody);
  const companyName = company?.trade_name || company?.legal_name || "Nexa Soluciones";
  const companyMeta = [company?.tax_id, company?.email, company?.phone, company?.address].filter(Boolean).join(" · ");
  const lines = wrapPdfLines([companyName, companyMeta, "", title, "", ...text.split("\n")].filter((line) => line !== undefined), 92);
  const content = buildSimplePdf(lines);
  const blob = new Blob([content], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<\/th>/gi, "  ")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapPdfLines(lines: string[], max = 92) {
  const wrapped: string[] = [];
  for (const raw of lines) {
    const line = String(raw ?? "");
    if (line.length <= max) {
      wrapped.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > max) {
      const cut = rest.lastIndexOf(" ", max);
      const index = cut > 20 ? cut : max;
      wrapped.push(rest.slice(0, index));
      rest = rest.slice(index).trimStart();
    }
    if (rest) wrapped.push(rest);
  }
  return wrapped;
}

function buildSimplePdf(lines: string[]) {
  const objects: string[] = [];
  const pageCount = Math.max(1, Math.ceil(lines.length / 42));
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("PAGES_PLACEHOLDER");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (let page = 0; page < pageCount; page++) {
    const pageLines = lines.slice(page * 42, page * 42 + 42);
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      "14 TL",
      ...pageLines.map((line, index) => `${index === 0 ? "" : "T* "}${pdfText(line)}`),
      "ET",
    ].join("\n");
    const contentId = objects.length + 2;
    const pageId = objects.length + 1;
    pageObjectIds.push(pageId);
    contentObjectIds.push(contentId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function pdfText(value: string) {
  const ascii = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "-");
  return `(${ascii.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj`;
}

export async function getCompanySettings(workspaceId: string): Promise<CompanySettings | null> {
  const { data, error } = await db
    .from("company_settings")
    .select("legal_name, trade_name, tax_id, email, phone, address, logo_url")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function renderOnePager(title: string, body: string, company?: CompanySettings | null) {
  const companyName = company?.trade_name || company?.legal_name || "Nexa Soluciones";
  const companyMeta = [company?.tax_id, company?.email, company?.phone, company?.address]
    .filter(Boolean)
    .map((x) => escapeHtml(String(x)))
    .join(" · ");
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
    .brand { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 28px; }
    .brand img { max-height: 54px; max-width: 150px; object-fit: contain; }
  </style>
</head>
<body>
  <div class="brand">
    ${company?.logo_url ? `<img src="${escapeHtml(company.logo_url)}" alt="${escapeHtml(companyName)}" />` : ""}
    <div>
      <strong>${escapeHtml(companyName)}</strong>
      <div class="muted">${companyMeta}</div>
    </div>
  </div>
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
  return 0;
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

