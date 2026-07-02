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
