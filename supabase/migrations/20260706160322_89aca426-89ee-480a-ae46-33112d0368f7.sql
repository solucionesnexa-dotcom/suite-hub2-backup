
-- Explicit admin-only write policies for user_roles to prevent privilege escalation
CREATE POLICY "Workspace admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "Workspace admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'))
WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "Workspace admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- Restrict database_export bucket to global admins only
CREATE POLICY "Global admins can view database exports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'database_export_03_07_26' AND public.has_global_role('admin'));

CREATE POLICY "Global admins can insert database exports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'database_export_03_07_26' AND public.has_global_role('admin'));

CREATE POLICY "Global admins can update database exports"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'database_export_03_07_26' AND public.has_global_role('admin'))
WITH CHECK (bucket_id = 'database_export_03_07_26' AND public.has_global_role('admin'));

CREATE POLICY "Global admins can delete database exports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'database_export_03_07_26' AND public.has_global_role('admin'));
