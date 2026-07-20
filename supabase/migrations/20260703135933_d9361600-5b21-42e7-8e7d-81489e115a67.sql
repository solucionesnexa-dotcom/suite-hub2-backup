CREATE OR REPLACE FUNCTION public.ensure_current_user_setup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id        UUID := auth.uid();
  current_email          TEXT := COALESCE(auth.jwt() ->> 'email', '');
  current_full_name      TEXT;
  current_workspace_name TEXT;
  existing_workspace_id  UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF current_email = '' THEN
    current_email := current_user_id::TEXT || '@user.local';
  END IF;

  current_full_name := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    split_part(current_email, '@', 1),
    'Usuario'
  );

  current_workspace_name := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'workspace_name',
    split_part(current_email, '@', 1) || '''s Workspace',
    'Nexa Workspace'
  );

  INSERT INTO public.profiles (id, email, full_name, ultimo_acceso)
  VALUES (current_user_id, current_email, current_full_name, now())
  ON CONFLICT (id) DO UPDATE
  SET
    email         = EXCLUDED.email,
    full_name     = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    ultimo_acceso = now(),
    updated_at    = now();

  SELECT wm.workspace_id
  INTO existing_workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = current_user_id
  ORDER BY wm.created_at ASC
  LIMIT 1;

  IF existing_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (current_workspace_name, current_user_id)
    RETURNING id INTO existing_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id)
    VALUES (existing_workspace_id, current_user_id)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, workspace_id, role)
    VALUES (current_user_id, existing_workspace_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, workspace_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.workspace_members (workspace_id, user_id)
    VALUES (existing_workspace_id, current_user_id)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, workspace_id, role)
    SELECT
      current_user_id,
      existing_workspace_id,
      CASE
        WHEN w.owner_id = current_user_id THEN 'admin'::public.app_role
        ELSE 'member'::public.app_role
      END
    FROM public.workspaces w
    WHERE w.id = existing_workspace_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = current_user_id
          AND ur.workspace_id = existing_workspace_id
      );
  END IF;

  INSERT INTO public.credit_accounts (workspace_id, balance)
  VALUES (existing_workspace_id, 20)
  ON CONFLICT (workspace_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_user_setup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_setup() TO service_role;
