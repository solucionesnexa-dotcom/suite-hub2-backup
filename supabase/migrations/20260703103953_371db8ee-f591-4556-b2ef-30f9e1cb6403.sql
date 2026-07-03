
-- Categorías
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('gasto','ingreso')),
  color text DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- Movimientos (gastos e ingresos)
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('gasto','ingreso')),
  description text NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_other text,
  supplier_name text,
  invoice_number text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  base_amount numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 21,
  vat_amount numeric(12,2) GENERATED ALWAYS AS (ROUND(base_amount * vat_rate / 100, 2)) STORED,
  total_amount numeric(12,2) GENERATED ALWAYS AS (ROUND(base_amount + (base_amount * vat_rate / 100), 2)) STORED,
  payment_method text DEFAULT 'transferencia',
  is_deductible boolean NOT NULL DEFAULT true,
  pdf_path text,
  notes text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_workspace_date ON public.expenses(workspace_id, invoice_date DESC);
CREATE INDEX idx_expenses_type ON public.expenses(workspace_id, entry_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- Periodos fiscales
CREATE TABLE public.tax_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  year int NOT NULL,
  quarter int NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  income numeric(12,2) NOT NULL DEFAULT 0,
  expenses numeric(12,2) NOT NULL DEFAULT 0,
  vat_collected numeric(12,2) NOT NULL DEFAULT 0,
  vat_paid numeric(12,2) NOT NULL DEFAULT 0,
  vat_result numeric(12,2) NOT NULL DEFAULT 0,
  irpf_estimated numeric(12,2) NOT NULL DEFAULT 0,
  irpf_rate numeric(5,2) NOT NULL DEFAULT 15,
  notes text,
  calculated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, year, quarter)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_periods TO authenticated;
GRANT ALL ON public.tax_periods TO service_role;
ALTER TABLE public.tax_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage tax periods" ON public.tax_periods
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- Triggers updated_at
CREATE TRIGGER expense_categories_updated_at BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tax_periods_updated_at BEFORE UPDATE ON public.tax_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed categorías por defecto para workspaces existentes
INSERT INTO public.expense_categories (workspace_id, name, type, color)
SELECT w.id, c.name, c.type, c.color FROM public.workspaces w
CROSS JOIN (VALUES
  ('Servicios profesionales','gasto','#3b82f6'),
  ('Software y suscripciones','gasto','#8b5cf6'),
  ('Marketing y publicidad','gasto','#ec4899'),
  ('Oficina y suministros','gasto','#f59e0b'),
  ('Viajes y dietas','gasto','#10b981'),
  ('Impuestos y tasas','gasto','#ef4444'),
  ('Otros gastos','gasto','#6b7280'),
  ('Ventas','ingreso','#10b981'),
  ('Servicios','ingreso','#3b82f6'),
  ('Otros ingresos','ingreso','#6b7280')
) AS c(name,type,color)
ON CONFLICT DO NOTHING;

-- Reload PostgREST cache (para el error de sepa_mandates.status)
NOTIFY pgrst, 'reload schema';
