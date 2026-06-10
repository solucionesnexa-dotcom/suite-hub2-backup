import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  apellidos: string | null;
  rol_global: "admin" | "consultor" | "viewer";
  activo: boolean;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, apellidos, rol_global, activo")
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}
