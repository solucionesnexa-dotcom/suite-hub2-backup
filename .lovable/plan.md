Voy a entregar el trabajo en 3 bloques. Cada bloque cierra una funcionalidad utilizable.

## Bloque 1 — Google Sign-In + roles globales

- Configurar Google OAuth gestionado (Lovable Cloud) y desactivar redirección manual: la pantalla `/auth` añade botón "Continuar con Google" usando `lovable.auth.signInWithOAuth("google")`.
- Migración: añadir `rol_global` (admin/consultor/viewer, default admin) y `activo` (bool, default true) a `profiles`. Renombrar `app_role` para incluir `consultor` y `viewer`. Trigger `handle_new_user` asigna rol admin al primer usuario del workspace, consultor al resto.
- Header muestra rol del usuario al lado del email.
- Helpers `has_global_role` para gating en UI.

## Bloque 2 — Importación de facturas PDF con IA

- Nuevo bucket privado `invoices` para guardar el PDF subido.
- Server function `extractInvoiceFromPdf` (`createServerFn`) que:
  1. Recibe el PDF en base64.
  2. Llama a Lovable AI Gateway (`google/gemini-3-flash-preview`) con `Output.object` (zod schema) pidiendo: `numero_factura`, `fecha_emision`, `fecha_vencimiento`, `importe`, `moneda`, `saas_origen`, `cliente_nombre`, `cliente_nif`, `concepto`.
  3. Devuelve los datos extraídos.
- UI en `/digifactu`: botón "Importar PDF" abre dialog → drag&drop de uno o varios PDFs → la IA extrae datos → tabla de revisión donde el usuario confirma/edita cliente (autocompletado, crea si no existe) e importes → confirma y crea las facturas.
- Resumen final: importadas, clientes nuevos, errores.

## Bloque 3 — Completar Prompt Maestro

Tablas y migraciones nuevas:

- `contactos` (cliente_id, nombre, apellidos, cargo, email, teléfono, canal_preferido, notas).
- `company_settings` (1 por workspace).
- `company_bank_accounts` (iban, bic, alias, activa, por_defecto).
- `credit_accounts` + `credit_movements` (modelado sólo, sin UI).
- Renombrar/extender `clients` con: `nombre_comercial`, `razon_social`, `sector`, `tamano`, `origen`, `estado` (prospecto/activo/pausado/perdido), `pais`, `provincia`, `ciudad`, `direccion`, `email_general` (ya existe `email` → migrar).
- Extender `invoices` con `saas_origen`, `fecha_vencimiento`, `estado_cobro` (pendiente/pagada/remesada/devuelta).
- `remesas` y `remesa_facturas`: ya existen como `remittances` / `remittance_invoices` — añadir `company_bank_account_id`, `fecha_cobro_prevista`, `numero_recibos`, estado extendido.

Pantallas:

- **Dashboard**: 4 KPIs (clientes activos, facturas pendientes, importe pendiente, remesas mes).
- **Clientes**: filtros (estado, sector, búsqueda); ficha con tabs (datos, contactos, mandatos SEPA, facturas).
- **Digifactu**:
  - Tabs: Facturas / Remesas.
  - Listado de facturas con badges de color por `estado_cobro` + aviso si cliente sin mandato.
  - Selección múltiple + "Crear remesa" → wizard con validación previa y selector de cuenta emisora + fecha cobro prevista.
  - Historial de remesas con detalle, descarga XML, actualización manual de estado.
- **Configuración** (3 secciones):
  - Mi empresa (company_settings).
  - Cuentas bancarias (CRUD + activa/defecto).
  - Usuarios del workspace + invitar (sólo admin).

Sidebar reordenado: Dashboard · Clientes · Digifactu · Configuración. Colores acentuados con la identidad visual del brief (primario `#2563eb`, sidebar `#0f172a`, etc.) aplicada vía tokens de `src/styles.css`.

## Notas técnicas

- Google OAuth se enciende con `configure_social_auth` (provider `google`) — credenciales gestionadas por Lovable Cloud, cero configuración manual.
- PDF: subimos como `data:application/pdf;base64,...` a la server fn; Gemini lo procesa nativamente.
- Roles: el `rol_global` en `profiles` complementa el `user_roles` por workspace que ya existe; el primer flujo MVP usa rol_global.
- Permisos UI: ocultar Configuración para `viewer`; ocultar "Usuarios" para `consultor`.

## Orden de ejecución

Te enviaré primero las migraciones (un único call combinado por bloque para minimizar interrupciones); cuando las apruebes, escribo todo el código de cada bloque y verifico build. Si quieres priorizar (ej. sólo bloques 1 y 2 ahora, y bloque 3 después), dímelo y arranco con eso. Si no, empiezo por el bloque 1.
