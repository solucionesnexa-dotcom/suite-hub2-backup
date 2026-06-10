
-- ============ EXTEND CLIENTS ============
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS nombre_comercial TEXT,
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS tamano TEXT,
  ADD COLUMN IF NOT EXISTS origen TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'ES',
  ADD COLUMN IF NOT EXISTS provincia TEXT,
  ADD COLUMN IF NOT EXISTS ciudad TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS email_general TEXT;

-- ============ EXTEND INVOICES ============
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS saas_origen TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
  ADD COLUMN IF NOT EXISTS estado_cobro TEXT NOT NULL DEFAULT 'pendiente';

-- ============ COMPANY SETTINGS ============
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  razon_social TEXT NOT NULL,
  cif TEXT,
  direccion TEXT,
  ciudad TEXT,
  provincia TEXT,
  pais TEXT DEFAULT 'ES',
  codigo_postal TEXT,
  telefono TEXT,
  email TEXT,
  web TEXT,
  logo_url TEXT,
  color_marca TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage company_settings" ON public.company_settings
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER trg_company_settings_updated BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ COMPANY BANK ACCOUNTS ============
CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  iban TEXT NOT NULL,
  bic TEXT,
  sepa_creditor_name TEXT NOT NULL,
  sepa_creditor_id TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_bank_accounts TO authenticated;
GRANT ALL ON public.company_bank_accounts TO service_role;
ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage company_bank_accounts" ON public.company_bank_accounts
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER trg_company_bank_accounts_updated BEFORE UPDATE ON public.company_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_cba_workspace ON public.company_bank_accounts(workspace_id);

-- ============ CONTACTOS ============
CREATE TABLE IF NOT EXISTS public.contactos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cargo TEXT,
  email TEXT,
  telefono TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contactos TO authenticated;
GRANT ALL ON public.contactos TO service_role;
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage contactos" ON public.contactos
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER trg_contactos_updated BEFORE UPDATE ON public.contactos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_contactos_client ON public.contactos(client_id);

-- ============ CREDITS (modeled, not exposed) ============
CREATE TABLE IF NOT EXISTS public.credit_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_accounts TO authenticated;
GRANT ALL ON public.credit_accounts TO service_role;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read credit_accounts" ON public.credit_accounts
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER trg_credit_accounts_updated BEFORE UPDATE ON public.credit_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.credit_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  reason TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.credit_movements TO authenticated;
GRANT ALL ON public.credit_movements TO service_role;
ALTER TABLE public.credit_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read credit_movements" ON public.credit_movements
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE INDEX IF NOT EXISTS idx_credit_movements_ws ON public.credit_movements(workspace_id);

-- ============ EXTEND REMITTANCES ============
ALTER TABLE public.remittances
  ADD COLUMN IF NOT EXISTS company_bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;
