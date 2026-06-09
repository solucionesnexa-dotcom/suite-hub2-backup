
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
CREATE TYPE public.invoice_status AS ENUM ('pending', 'included', 'paid', 'cancelled');
CREATE TYPE public.remittance_status AS ENUM ('draft', 'generated', 'submitted', 'processed');

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- =========== WORKSPACES ===========
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- =========== WORKSPACE MEMBERS ===========
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- =========== USER ROLES (per workspace) ===========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========== SECURITY DEFINER HELPERS ===========
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id UUID, _workspace_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = _role
  );
$$;

-- Policies for workspaces / members / roles
CREATE POLICY "Members can view workspaces" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id));
CREATE POLICY "Users can create workspaces" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins can update workspaces" ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), id, 'admin'));
CREATE POLICY "Admins can delete workspaces" ON public.workspaces FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), id, 'admin'));

CREATE POLICY "Members can view members" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins can add members" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admins can remove members" ON public.workspace_members FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "Members can view roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- =========== CLIENTS ===========
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  iban TEXT,
  bic TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view clients" ON public.clients FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete clients" ON public.clients FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- =========== SEPA MANDATES ===========
CREATE TABLE public.sepa_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  mandate_reference TEXT NOT NULL,
  iban TEXT NOT NULL,
  bic TEXT,
  debtor_name TEXT NOT NULL,
  signature_date DATE NOT NULL,
  sequence_type TEXT NOT NULL DEFAULT 'RCUR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sepa_mandates TO authenticated;
GRANT ALL ON public.sepa_mandates TO service_role;
ALTER TABLE public.sepa_mandates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view mandates" ON public.sepa_mandates FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert mandates" ON public.sepa_mandates FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update mandates" ON public.sepa_mandates FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete mandates" ON public.sepa_mandates FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- =========== INVOICES ===========
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES public.sepa_mandates(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  concept TEXT,
  status public.invoice_status NOT NULL DEFAULT 'pending',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- =========== REMITTANCES ===========
CREATE TABLE public.remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  creditor_name TEXT NOT NULL,
  creditor_iban TEXT NOT NULL,
  creditor_bic TEXT,
  creditor_id TEXT NOT NULL,
  collection_date DATE NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  transaction_count INTEGER NOT NULL,
  xml_content TEXT NOT NULL,
  status public.remittance_status NOT NULL DEFAULT 'generated',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remittances TO authenticated;
GRANT ALL ON public.remittances TO service_role;
ALTER TABLE public.remittances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view remittances" ON public.remittances FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert remittances" ON public.remittances FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update remittances" ON public.remittances FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete remittances" ON public.remittances FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- =========== REMITTANCE INVOICES ===========
CREATE TABLE public.remittance_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id UUID NOT NULL REFERENCES public.remittances(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  UNIQUE (remittance_id, invoice_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remittance_invoices TO authenticated;
GRANT ALL ON public.remittance_invoices TO service_role;
ALTER TABLE public.remittance_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view remittance items" ON public.remittance_invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.remittances r WHERE r.id = remittance_id AND public.is_workspace_member(auth.uid(), r.workspace_id)));
CREATE POLICY "Members can insert remittance items" ON public.remittance_invoices FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.remittances r WHERE r.id = remittance_id AND public.is_workspace_member(auth.uid(), r.workspace_id)));
CREATE POLICY "Members can delete remittance items" ON public.remittance_invoices FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.remittances r WHERE r.id = remittance_id AND public.is_workspace_member(auth.uid(), r.workspace_id)));

-- =========== TRIGGERS ===========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mandates_updated BEFORE UPDATE ON public.sepa_mandates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + workspace + admin role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_ws_id UUID;
  ws_name TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  ws_name := COALESCE(NEW.raw_user_meta_data->>'workspace_name', split_part(NEW.email, '@', 1) || '''s Workspace');

  INSERT INTO public.workspaces (name, owner_id)
  VALUES (ws_name, NEW.id)
  RETURNING id INTO new_ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id) VALUES (new_ws_id, NEW.id);
  INSERT INTO public.user_roles (user_id, workspace_id, role) VALUES (NEW.id, new_ws_id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
