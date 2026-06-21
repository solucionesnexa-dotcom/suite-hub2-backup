CREATE OR REPLACE FUNCTION public.ensure_current_user_setup()
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_email TEXT;
  current_name TEXT;
  current_workspace public.workspaces%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  INTO current_email, current_name
  FROM auth.users
  WHERE id = current_user_id;

  IF current_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, rol_global, activo)
  VALUES (current_user_id, current_email, current_name, 'admin', TRUE)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    activo = COALESCE(public.profiles.activo, TRUE),
    updated_at = now();

  SELECT w.*
  INTO current_workspace
  FROM public.workspaces w
  JOIN public.workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id = current_user_id
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF current_workspace.id IS NULL THEN
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (
      COALESCE(
        (SELECT raw_user_meta_data->>'workspace_name' FROM auth.users WHERE id = current_user_id),
        split_part(current_email, '@', 1) || '''s Workspace'
      ),
      current_user_id
    )
    RETURNING * INTO current_workspace;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id)
  VALUES (current_workspace.id, current_user_id)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, workspace_id, role)
  VALUES (current_user_id, current_workspace.id, 'admin')
  ON CONFLICT (user_id, workspace_id, role) DO NOTHING;

  INSERT INTO public.credit_accounts (workspace_id, balance)
  VALUES (current_workspace.id, 20)
  ON CONFLICT (workspace_id) DO NOTHING;

  RETURN current_workspace;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_current_user_setup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_setup() TO authenticated;
