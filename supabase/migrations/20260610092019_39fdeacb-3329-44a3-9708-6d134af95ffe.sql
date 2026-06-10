DROP POLICY IF EXISTS "Admins can add members" ON public.workspace_members;
CREATE POLICY "Admins can add members" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));