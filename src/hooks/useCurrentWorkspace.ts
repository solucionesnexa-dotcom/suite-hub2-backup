import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Workspace = { id: string; name: string; owner_id: string };

export function useCurrentWorkspace() {
  return useQuery({
    queryKey: ["current-workspace"],
    queryFn: async (): Promise<Workspace | null> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, owner_id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
