
-- 1) Storage RLS policies for the 'facturas' bucket (workspace-scoped: first folder = workspace_id)
CREATE POLICY "Workspace members can view facturas"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'facturas' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Workspace members can upload facturas"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'facturas' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Workspace members can update facturas"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'facturas' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Workspace members can delete facturas"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'facturas' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- 2) Storage RLS policies for the 'remesas' bucket (workspace-scoped, same shape)
CREATE POLICY "Workspace members can view remesas"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'remesas' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Workspace members can upload remesas"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'remesas' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Workspace members can update remesas"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'remesas' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Workspace members can delete remesas"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'remesas' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- 3) Fix existing INSERT policy on sepa-mandates (currently has no WITH CHECK)
DROP POLICY IF EXISTS "Workspace members can upload sepa mandates" ON storage.objects;
CREATE POLICY "Workspace members can upload sepa mandates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sepa-mandates' AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- 4) Store XML path on remittances so we can serve from storage later
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS xml_path TEXT;
