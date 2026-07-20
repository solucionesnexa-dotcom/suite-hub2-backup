-- 1. Prevent self role escalation on profiles
CREATE POLICY "Prevent self role change"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  rol_global = (SELECT rol_global FROM public.profiles WHERE id = auth.uid())
  AND activo = (SELECT activo FROM public.profiles WHERE id = auth.uid())
);

-- 2. Restrict SECURITY DEFINER functions from anon/public callers
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_global_role(public.global_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
