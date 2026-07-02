-- ============================================
-- Storage buckets y policies para FactuNexa
-- ============================================

-- 1) Crear buckets necesarios
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

-- 2) Policies de RLS para storage.objects
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
