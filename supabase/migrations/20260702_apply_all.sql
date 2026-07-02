-- ==================================================
-- Apply all ContaNexa related migrations (storage + invoice sync + pdf + categories)
-- Run this file in Supabase SQL editor as an admin. Execute all at once or step-by-step.
-- ==================================================

-- -----------------------------
-- 1) Storage buckets & RLS policies
-- -----------------------------

-- From: 20260702_create_storage_buckets.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('sepa-mandates', 'sepa-mandates', false, 10485760, ARRAY['application/pdf']),
  ('remesas', 'remesas', false, 10485760, ARRAY['application/xml']),
  ('facturas', 'facturas', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies for storage.objects (abbreviated copy)
DROP POLICY IF EXISTS "Workspace members can view sepa mandates" ON storage.objects;
CREATE POLICY "Workspace members can view sepa mandates"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sepa-mandates'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can upload sepa mandates" ON storage.objects;
CREATE POLICY "Workspace members can upload sepa mandates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sepa-mandates'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can update sepa mandates" ON storage.objects;
CREATE POLICY "Workspace members can update sepa mandates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sepa-mandates'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'sepa-mandates'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can delete sepa mandates" ON storage.objects;
CREATE POLICY "Workspace members can delete sepa mandates"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sepa-mandates'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can view remesas" ON storage.objects;
CREATE POLICY "Workspace members can view remesas"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'remesas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can upload remesas" ON storage.objects;
CREATE POLICY "Workspace members can upload remesas"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'remesas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can update remesas" ON storage.objects;
CREATE POLICY "Workspace members can update remesas"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'remesas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'remesas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can delete remesas" ON storage.objects;
CREATE POLICY "Workspace members can delete remesas"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'remesas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can view facturas" ON storage.objects;
CREATE POLICY "Workspace members can view facturas"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'facturas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can upload facturas" ON storage.objects;
CREATE POLICY "Workspace members can upload facturas"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'facturas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can update facturas" ON storage.objects;
CREATE POLICY "Workspace members can update facturas"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'facturas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'facturas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Workspace members can delete facturas" ON storage.objects;
CREATE POLICY "Workspace members can delete facturas"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'facturas'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );



-- -----------------------------
-- 2) Contanexa invoice sync (trigger + backfill)
-- -----------------------------

-- From: 20260702_contanexa_invoice_sync.sql

-- ============================================
-- ContaNexa · Sincronización de facturas pagadas desde FactuNexa
-- ============================================

-- 1) Añadir columnas necesarias para ingresos y workspace
ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'gasto' CHECK (entry_type IN ('gasto', 'ingreso'));

ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);

ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_invoice_id_key'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_invoice_id_key UNIQUE (invoice_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_expenses_workspace_id ON public.expenses (workspace_id);
CREATE INDEX IF NOT EXISTS idx_expenses_entry_type ON public.expenses (entry_type);

-- 2) Función y trigger para sincronizar facturas pagadas
CREATE OR REPLACE FUNCTION public.sync_paid_invoice_to_contanexa()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.payment_status = 'paid')
     OR (TG_OP = 'UPDATE' AND OLD.payment_status <> 'paid' AND NEW.payment_status = 'paid')
  THEN
    INSERT INTO public.expenses (
      workspace_id,
      entry_type,
      supplier_name,
      client_id,
      invoice_id,
      invoice_number,
      invoice_date,
      due_date,
      base_amount,
      vat_rate,
      payment_method,
      paid,
      paid_at,
      notes,
      created_at
    )
    VALUES (
      NEW.workspace_id,
      'ingreso',
      (SELECT name FROM public.clients WHERE id = NEW.client_id),
      NEW.client_id,
      NEW.id,
      NEW.invoice_number,
      NEW.issue_date::date,
      NEW.due_date::date,
      NEW.amount,
      0,
      NEW.payment_method,
      TRUE,
      NEW.paid_at::date,
      'Sincronización automática de FactuNexa',
      NOW()
    )
    ON CONFLICT (invoice_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_paid_invoice_to_contanexa_trigger ON public.invoices;
CREATE TRIGGER sync_paid_invoice_to_contanexa_trigger
AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_paid_invoice_to_contanexa();

-- 3) Backfill de facturas ya pagadas
INSERT INTO public.expenses (
  workspace_id,
  entry_type,
  supplier_name,
  client_id,
  invoice_id,
  invoice_number,
  invoice_date,
  due_date,
  base_amount,
  vat_rate,
  payment_method,
  paid,
  paid_at,
  notes,
  created_at
)
SELECT
  i.workspace_id,
  'ingreso',
  c.name,
  i.client_id,
  i.id,
  i.invoice_number,
  i.issue_date::date,
  i.due_date::date,
  i.amount,
  0,
  i.payment_method,
  TRUE,
  i.paid_at::date,
  'Sincronización histórica de FactuNexa',
  NOW()
FROM public.invoices i
LEFT JOIN public.clients c ON c.id = i.client_id
WHERE i.payment_status = 'paid'
  AND i.id NOT IN (SELECT invoice_id FROM public.expenses WHERE invoice_id IS NOT NULL);

-- 4) RLS workspace-scoped para expenses e invoices
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado" ON public.expenses;
DROP POLICY IF EXISTS "Members can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Members can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Members can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Members can delete expenses" ON public.expenses;

CREATE POLICY "Members can view expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete expenses" ON public.expenses FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can delete invoices" ON public.invoices;

CREATE POLICY "Members can view invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));



-- -----------------------------
-- 3) Añadir pdf_path a expenses
-- -----------------------------

-- From: 20260702_expenses_add_pdf_path.sql
ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;


-- -----------------------------
-- 4) Seed categories
-- -----------------------------

-- From: 20260702_seed_expense_categories.sql
-- Seed default expense categories for ContaNexa
INSERT INTO expense_categories (id, name, code, type, created_at)
VALUES
-- 1
  (gen_random_uuid(), 'Alquiler de oficinas y espacios de trabajo', 'ALQUILER', 'gasto', NOW()),
-- 2
  (gen_random_uuid(), 'Suministros (luz, agua, internet, teléfono)', 'SUMINISTROS', 'gasto', NOW()),
-- 3
  (gen_random_uuid(), 'Software, suscripciones y servicios web', 'SOFTWARE', 'gasto', NOW()),
-- 4
  (gen_random_uuid(), 'Servicios profesionales y asesoría', 'SERVICIOS_PROFESIONALES', 'gasto', NOW()),
-- 5
  (gen_random_uuid(), 'Gastos de personal (sueldos y salarios)', 'PERSONAL_SUELDOS', 'gasto', NOW()),
-- 6
  (gen_random_uuid(), 'Seguridad Social y otros costes de personal', 'PERSONAL_SS', 'gasto', NOW()),
-- 7
  (gen_random_uuid(), 'Formación y desarrollo del equipo', 'FORMACION', 'gasto', NOW()),
-- 8
  (gen_random_uuid(), 'Material de oficina y papelería', 'OFICINA', 'gasto', NOW()),
-- 9
  (gen_random_uuid(), 'Equipos y hardware informático', 'HARDWARE', 'gasto', NOW()),
-- 10
  (gen_random_uuid(), 'Viajes, dietas y desplazamientos', 'VIAJES', 'gasto', NOW()),
-- 11
  (gen_random_uuid(), 'Marketing, publicidad y eventos', 'MARKETING', 'gasto', NOW()),
-- 12
  (gen_random_uuid(), 'Gastos de representación y clientes', 'REPRESENTACION', 'gasto', NOW()),
-- 13
  (gen_random_uuid(), 'Seguros', 'SEGUROS', 'gasto', NOW()),
-- 14
  (gen_random_uuid(), 'Gastos bancarios y comisiones', 'GASTOS_BANCARIOS', 'gasto', NOW()),
-- 15
  (gen_random_uuid(), 'Intereses y otros gastos financieros', 'GASTOS_FINANCIEROS', 'gasto', NOW()),
-- 16
  (gen_random_uuid(), 'Impuestos y tasas', 'IMPUESTOS', 'gasto', NOW()),
-- 17
  (gen_random_uuid(), 'Gastos de limpieza, mantenimiento y consumibles', 'MANTENIMIENTO', 'gasto', NOW()),
-- 18
  (gen_random_uuid(), 'Gastos legales y registros', 'GASTOS_LEGALES', 'gasto', NOW()),
-- 19
  (gen_random_uuid(), 'Gastos extraordinarios / imprevistos', 'EXTRAORDINOS', 'gasto', NOW()),
-- 20
  (gen_random_uuid(), 'Otros gastos', 'OTROS_GASTOS', 'gasto', NOW())
ON CONFLICT (code) DO NOTHING;