CREATE TABLE IF NOT EXISTS public.pipeline_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nota TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nota' CHECK (tipo IN ('nota', 'llamada', 'reunion', 'propuesta', 'otro')),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_notas TO authenticated;
GRANT ALL ON public.pipeline_notas TO service_role;

ALTER TABLE public.pipeline_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view pipeline notes" ON public.pipeline_notas
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = pipeline_notas.cliente_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
);

CREATE POLICY "members can insert pipeline notes" ON public.pipeline_notas
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = pipeline_notas.cliente_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
);

CREATE POLICY "members can update own pipeline notes" ON public.pipeline_notas
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = pipeline_notas.cliente_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = pipeline_notas.cliente_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
);

CREATE POLICY "members can delete own pipeline notes" ON public.pipeline_notas
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = pipeline_notas.cliente_id
      AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_pipeline_notas_cliente ON public.pipeline_notas(cliente_id, fecha DESC);
