// Shared domain types — keep in sync with public schema columns/checks.
// Importing these instead of redefining per-file keeps payment_method, mandate
// statuses, etc. consistent between forms, mutations and the SEPA generator.

export type PaymentMethod =
  | "transferencia"
  | "domiciliacion"
  | "efectivo"
  | "bizum"
  | "tarjeta"
  | "paypal"
  | "cheque"
  | "otro";

export type PaymentStatus = "pending" | "paid";

export type MandateSequenceType = "FRST" | "RCUR" | "OOFF" | "FNAL";

export type MandateStatus = "activo" | "pendiente" | "cancelado";

export type RemittanceStatus = "draft" | "generated" | "processed" | "submitted";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "domiciliacion", label: "Domiciliación bancaria (SEPA DD)" },
  { value: "efectivo", label: "Efectivo" },
  { value: "bizum", label: "Bizum" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "paypal", label: "PayPal" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
];

// Storage bucket / path conventions. RLS depends on first folder = workspace_id.
export const STORAGE = {
  mandates: {
    bucket: "sepa-mandates",
    path: (workspaceId: string, clientId: string, filename: string) =>
      `${workspaceId}/${clientId}/${filename}`,
  },
  facturas: {
    bucket: "facturas",
    path: (workspaceId: string, clientId: string, filename: string) =>
      `${workspaceId}/${clientId}/${filename}`,
  },
  remesas: {
    bucket: "remesas",
    path: (workspaceId: string, remittanceId: string) =>
      `${workspaceId}/${remittanceId}.xml`,
  },
} as const;
