
DROP POLICY IF EXISTS "Members update credit account" ON public.credit_accounts;
DROP POLICY IF EXISTS "Members insert credit account" ON public.credit_accounts;
DROP POLICY IF EXISTS "Members insert credit movements" ON public.credit_movements;

CREATE POLICY "Admins update credit account"
ON public.credit_accounts FOR UPDATE
USING (public.has_global_role('admin') AND public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.has_global_role('admin') AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins insert credit account"
ON public.credit_accounts FOR INSERT
WITH CHECK (public.has_global_role('admin') AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members insert non-positive credit movements"
ON public.credit_movements FOR INSERT
WITH CHECK (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND (amount <= 0 OR public.has_global_role('admin'))
);
