import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonRecord = Record<string, unknown>;

function readString(source: JsonRecord | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const ensureCurrentUserSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const now = new Date().toISOString();
    const claims = context.claims as JsonRecord;
    const metadata =
      claims.user_metadata && typeof claims.user_metadata === "object"
        ? (claims.user_metadata as JsonRecord)
        : undefined;

    const email = readString(claims, "email") ?? `${context.userId}@user.local`;
    const fullName =
      readString(metadata, "full_name") ?? readString(metadata, "name") ?? email.split("@")[0];
    const workspaceName = readString(metadata, "workspace_name") ?? `${email.split("@")[0]}'s Workspace`;

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: context.userId,
        email,
        full_name: fullName,
        ultimo_acceso: now,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    const { data: membership, error: membershipError } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;

    let workspaceId = membership?.workspace_id as string | undefined;

    if (!workspaceId) {
      const { data: workspace, error: workspaceError } = await admin
        .from("workspaces")
        .insert({ name: workspaceName, owner_id: context.userId })
        .select("id")
        .single();
      if (workspaceError) throw workspaceError;

      workspaceId = workspace.id;

      const { error: memberError } = await admin
        .from("workspace_members")
        .upsert({ workspace_id: workspaceId, user_id: context.userId }, { onConflict: "workspace_id,user_id" });
      if (memberError) throw memberError;
    }

    const { data: workspace, error: workspaceReadError } = await admin
      .from("workspaces")
      .select("owner_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (workspaceReadError) throw workspaceReadError;

    const role = workspace?.owner_id === context.userId ? "admin" : "member";
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, workspace_id: workspaceId, role },
        { onConflict: "user_id,workspace_id,role" },
      );
    if (roleError) throw roleError;

    const { error: creditsError } = await admin
      .from("credit_accounts")
      .upsert(
        { workspace_id: workspaceId, balance: 0, updated_at: now },
        { onConflict: "workspace_id", ignoreDuplicates: true },
      );
    if (creditsError) throw creditsError;

    return { workspaceId };
  });