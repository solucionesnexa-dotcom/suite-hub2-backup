-- ============================================
-- ContaNexa · Migración inicial
-- ============================================

-- Categorías de gastos
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL, -- ej: "SUMINISTROS", "MARKETING"
  type TEXT NOT NULL CHECK (type IN ('gasto', 'ingreso')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Facturas de compra / gastos
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  supplier_nif TEXT,
  invoice_number TEXT,
  invoice_date DATE NOT NULL,
  due_date DATE,
  category_id UUID REFERENCES expense_categories(id),
  base_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 21,
  vat_amount NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(base_amount * vat_rate / 100, 2)) STORED,
  total_amount NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(base_amount + base_amount * vat_rate / 100, 2)) STORED,
  payment_method TEXT CHECK (payment_method IN ('transferencia', 'tarjeta', 'efectivo', 'domiciliacion')),
  paid BOOLEAN DEFAULT FALSE,
  paid_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Periodos fiscales trimestrales
CREATE TABLE IF NOT EXISTS tax_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  status TEXT DEFAULT 'abierto' CHECK (status IN ('abierto', 'cerrado', 'presentado')),
  vat_collected NUMERIC(10,2), -- IVA repercutido (de facturas emitidas)
  vat_paid NUMERIC(10,2),      -- IVA soportado (de gastos)
  vat_result NUMERIC(10,2),    -- A ingresar o devolver
  closed_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(year, quarter)
);

-- Categorías por defecto (plan básico)
INSERT INTO expense_categories (name, code, type) VALUES
  ('Suministros', 'SUMINISTROS', 'gasto'),
  ('Marketing y publicidad', 'MARKETING', 'gasto'),
  ('Software y suscripciones', 'SOFTWARE', 'gasto'),
  ('Asesoría y servicios profesionales', 'ASESORIA', 'gasto'),
  ('Material de oficina', 'OFICINA', 'gasto'),
  ('Viajes y dietas', 'VIAJES', 'gasto'),
  ('Alquiler', 'ALQUILER', 'gasto'),
  ('Nóminas y autónomos', 'NOMINAS', 'gasto'),
  ('Otros gastos', 'OTROS_GASTO', 'gasto'),
  ('Servicios prestados', 'SERVICIOS', 'ingreso'),
  ('Otros ingresos', 'OTROS_INGRESO', 'ingreso')
ON CONFLICT (code) DO NOTHING;

-- RLS básico (ajusta según tu auth de Supabase)
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso autenticado" ON expense_categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acceso autenticado" ON expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acceso autenticado" ON tax_periods FOR ALL USING (auth.role() = 'authenticated');