DO $$ BEGIN
  CREATE TYPE public.pipeline_status AS ENUM (
    'prospecto',
    'diagnostico',
    'propuesta_enviada',
    'negociacion',
    'cerrado',
    'retainer_activo',
    'pausado',
    'perdido'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.simple_doc_status AS ENUM ('borrador', 'completado', 'finalizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.presupuesto_status AS ENUM ('borrador', 'enviado', 'aceptado', 'rechazado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.retainer_status AS ENUM ('activo', 'pausado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pendiente', 'en_curso', 'completada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status public.pipeline_status NOT NULL DEFAULT 'prospecto',
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

DO $$ BEGIN
  CREATE POLICY "Admins can view profiles" ON public.profiles FOR SELECT TO authenticated
    USING (public.has_global_role('admin') OR auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  legal_name TEXT,
  trade_name TEXT,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  ai_provider TEXT,
  ai_api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.credit_accounts (workspace_id, balance)
SELECT id, 20 FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_credit_account_for_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credit_accounts (workspace_id, balance)
  VALUES (NEW.id, 20)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_credit_account ON public.workspaces;
CREATE TRIGGER trg_workspaces_credit_account
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.ensure_credit_account_for_workspace();

CREATE TABLE IF NOT EXISTS public.diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  puntuacion INTEGER NOT NULL DEFAULT 0 CHECK (puntuacion BETWEEN 0 AND 100),
  quick_wins JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  estado public.simple_doc_status NOT NULL DEFAULT 'borrador',
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diagnostico_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id UUID NOT NULL REFERENCES public.diagnosticos(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  peso INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_validez DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '15 days')::date,
  estado public.presupuesto_status NOT NULL DEFAULT 'borrador',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas_internas TEXT,
  notas_cliente TEXT,
  pdf_url TEXT,
  creado_por UUID REFERENCES auth.users(id),
  diagnostico_id UUID REFERENCES public.diagnosticos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, numero)
);

CREATE TABLE IF NOT EXISTS public.presupuesto_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id UUID NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'servicio_unico',
  importe NUMERIC(12,2) NOT NULL DEFAULT 0,
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
  total_linea NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.roi_calculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  nombre_calculo TEXT NOT NULL,
  proceso_descripcion TEXT NOT NULL,
  horas_semana NUMERIC(10,2) NOT NULL DEFAULT 0,
  coste_hora NUMERIC(10,2) NOT NULL DEFAULT 0,
  semanas_por_ano INTEGER NOT NULL DEFAULT 48,
  coste_implantacion NUMERIC(12,2) NOT NULL DEFAULT 0,
  ahorro_anual_calculado NUMERIC(12,2) NOT NULL DEFAULT 0,
  roi_meses_calculado NUMERIC(10,2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  objetivo TEXT,
  responsable TEXT,
  proceso_descripcion_raw TEXT NOT NULL,
  pasos JSONB NOT NULL DEFAULT '[]'::jsonb,
  entregable TEXT,
  estado public.simple_doc_status NOT NULL DEFAULT 'borrador',
  pdf_url TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.casos_exito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_anonimo BOOLEAN NOT NULL DEFAULT false,
  sector TEXT,
  problema TEXT NOT NULL,
  solucion TEXT NOT NULL,
  herramientas_usadas TEXT[] NOT NULL DEFAULT '{}',
  resultado_cuantificable TEXT,
  post_linkedin TEXT,
  pdf_contenido TEXT,
  pdf_url TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipeline_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  nota TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT NOT NULL DEFAULT 'nota'
);

CREATE TABLE IF NOT EXISTS public.retainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  horas_contratadas_mes NUMERIC(10,2) NOT NULL DEFAULT 0,
  importe_mes NUMERIC(12,2) NOT NULL DEFAULT 0,
  dia_facturacion INTEGER NOT NULL DEFAULT 1 CHECK (dia_facturacion BETWEEN 1 AND 28),
  estado public.retainer_status NOT NULL DEFAULT 'activo',
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  notas TEXT
);

CREATE TABLE IF NOT EXISTS public.retainer_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retainer_id UUID NOT NULL REFERENCES public.retainers(id) ON DELETE CASCADE,
  mes_ano TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  estado public.task_status NOT NULL DEFAULT 'pendiente',
  horas_estimadas NUMERIC(10,2) NOT NULL DEFAULT 0,
  horas_reales NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_completada DATE
);

CREATE TABLE IF NOT EXISTS public.prospector_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nombre_comercial TEXT NOT NULL,
  sector TEXT,
  web TEXT,
  email TEXT,
  telefono TEXT,
  localidad TEXT,
  direccion TEXT,
  google_place_id TEXT,
  google_maps_url TEXT,
  rating NUMERIC(3,2),
  reviews_count INTEGER,
  fuente TEXT NOT NULL DEFAULT 'manual',
  necesidad_detectada TEXT,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  oportunidad_score INTEGER NOT NULL DEFAULT 0 CHECK (oportunidad_score BETWEEN 0 AND 100),
  oportunidad_analisis JSONB NOT NULL DEFAULT '{}'::jsonb,
  propuesta_comercial TEXT,
  estado TEXT NOT NULL DEFAULT 'nuevo',
  notas TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_workspace_status ON public.clients(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_movements_workspace ON public.credit_movements(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presupuestos_workspace ON public.presupuestos(workspace_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_roi_workspace ON public.roi_calculos(workspace_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_retainers_workspace ON public.retainers(workspace_id, estado);
CREATE INDEX IF NOT EXISTS idx_prospector_workspace_estado ON public.prospector_leads(workspace_id, estado, score DESC);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostico_respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roi_calculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casos_exito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retainer_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospector_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company settings" ON public.company_settings FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members view credit account" ON public.credit_accounts FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members update credit account" ON public.credit_accounts FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins insert credit account" ON public.credit_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_global_role('admin') AND public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins delete credit account" ON public.credit_accounts FOR DELETE TO authenticated
  USING (public.has_global_role('admin') AND public.is_workspace_member(auth.uid(), workspace_id))
;
CREATE POLICY "Members view credit movements" ON public.credit_movements FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins add credit movements" ON public.credit_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_global_role('admin') AND public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members add spending movements" ON public.credit_movements FOR INSERT TO authenticated
  WITH CHECK (delta < 0 AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members manage diagnosticos" ON public.diagnosticos FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members manage diagnostico respuestas" ON public.diagnostico_respuestas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnosticos d WHERE d.id = diagnostico_id AND public.is_workspace_member(auth.uid(), d.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.diagnosticos d WHERE d.id = diagnostico_id AND public.is_workspace_member(auth.uid(), d.workspace_id)));
CREATE POLICY "Members manage presupuestos" ON public.presupuestos FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members manage presupuesto lineas" ON public.presupuesto_lineas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.presupuestos p WHERE p.id = presupuesto_id AND public.is_workspace_member(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.presupuestos p WHERE p.id = presupuesto_id AND public.is_workspace_member(auth.uid(), p.workspace_id)));
CREATE POLICY "Members manage roi" ON public.roi_calculos FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members manage sops" ON public.sops FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members manage casos" ON public.casos_exito FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members manage pipeline notas" ON public.pipeline_notas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND public.is_workspace_member(auth.uid(), c.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND public.is_workspace_member(auth.uid(), c.workspace_id)));
CREATE POLICY "Members manage retainers" ON public.retainers FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members manage retainer tareas" ON public.retainer_tareas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.retainers r WHERE r.id = retainer_id AND public.is_workspace_member(auth.uid(), r.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.retainers r WHERE r.id = retainer_id AND public.is_workspace_member(auth.uid(), r.workspace_id)));
CREATE POLICY "Members manage prospector leads" ON public.prospector_leads FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER trg_company_settings_updated BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_diagnosticos_updated BEFORE UPDATE ON public.diagnosticos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_presupuestos_updated BEFORE UPDATE ON public.presupuestos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sops_updated BEFORE UPDATE ON public.sops FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prospector_leads_updated BEFORE UPDATE ON public.prospector_leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
