# FactuNexa — Notas técnicas

Módulo de facturación + remesas SEPA para Nexa Suite.

## Flujo de datos

```
clients ──┐
          ├──► invoices ──► remittance_invoices ──► remittances ──► XML pain.008
sepa_mandates ┘   (payment_method=domiciliacion + mandato activo)
```

- `clients`: alta manual o desde import. Lleva IBAN/BIC opcionales que se usan como fallback si el mandato no los tiene.
- `sepa_mandates`: un cliente puede tener varios; el "activo" (`status='activo'` / `is_active=true`) es el que se usa para remesas. Lleva `pdf_path` apuntando al bucket `sepa-mandates`.
- `invoices`: además de los campos clásicos llevan `payment_method` (incluye `domiciliacion`), `payment_status` (`pending|paid`) y `pdf_path`.
- `remittances`: cabecera de la remesa SEPA. Guarda `xml_content` (texto) y `xml_path` (ruta en bucket `remesas`).
- `remittance_invoices`: tabla puente con `amount` para auditar el importe que entró en la remesa.

## Buckets de Storage

Todos privados; el path **debe** empezar por `workspace_id` para cumplir las policies RLS basadas en `is_workspace_member`.

| Bucket          | Path                                                        | Contenido              |
|-----------------|-------------------------------------------------------------|------------------------|
| `sepa-mandates` | `{workspace_id}/{client_id}/{timestamp}-{name}.pdf`         | PDFs de mandatos firmados |
| `facturas`      | `{workspace_id}/{client_id}/{timestamp}-{name}.pdf`         | PDFs de facturas importadas |
| `remesas`       | `{workspace_id}/{remittance_id}.xml`                        | XML pain.008 generados |

Las constantes y helpers de path viven en `src/lib/types.ts → STORAGE`.

## Reglas del flujo de remesas

`RemittanceTab` solo lista facturas elegibles:

- `payment_method = 'domiciliacion'`
- `payment_status = 'pending'`
- `status != 'included'`
- el cliente tiene un mandato SEPA activo

Al pulsar **Generar XML**:

1. `validateRemittance(input)` — chequea IBAN/BIC, importes, mandatos.
2. `INSERT` en `remittances` con `status='generated'`, `xml_content` inline.
3. Sube el XML al bucket `remesas` y actualiza `xml_path`. Si falla, queda solo el `xml_content` (el botón "Descargar XML" sigue funcionando).
4. `INSERT` en `remittance_invoices` (puente).
5. `UPDATE invoices SET status='included'` para las facturas incluidas.
6. Descarga local del XML.

`deleteRemittanceMut` revierte los pasos: facturas vuelven a `pending`/no-included, se borran los links y la remesa.

## Permisos

- `useCanEdit()` → `viewer` global no puede mutar nada.
- Toda inserción incluye `workspace_id` (NOT NULL en todas las tablas) y se respeta vía RLS con `is_workspace_member()`.

## Pendiente / próximos pasos

- Refactor de `useCanEdit` para mirar también el `role` del miembro en el workspace (owner/admin/editor/viewer) — hoy solo gate por `rol_global`.
- Extraer formulario de factura a componente reutilizable (`<InvoiceForm />`); ahora está duplicado en crear/editar.
- Tests Vitest del flujo: `validateRemittance` + `generateSepaXml` con fixtures.
- Botón "Re-descargar XML desde storage" en `HistoryTab` cuando `xml_path` está presente.
