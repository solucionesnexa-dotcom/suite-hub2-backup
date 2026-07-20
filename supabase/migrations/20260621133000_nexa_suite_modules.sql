-- ============================================
-- Nexa Suite · Módulos y estructura avanzada
-- ============================================

-- Enums varios para estados de pipeline, docs, etc.
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

-- Extender remittance_status
ALTER TYPE public.remittance_status ADD VALUE 
