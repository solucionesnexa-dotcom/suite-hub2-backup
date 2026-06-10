-- Global role enum
DO $$ BEGIN
  CREATE TYPE public.global_role AS ENUM ('admin', 'consultor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apellidos TEXT,
  ADD COLUMN IF NOT EXISTS rol_global public.global_role NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

-- Helper to check current user global role
CREATE OR REPLACE FUNCTION public.has_global_role(_role public.global_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol_global = _role AND activo = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_global_role(public.global_role) TO authenticated;