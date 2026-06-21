import { useProfile } from "@/hooks/useProfile";

export function useCanEdit() {
  const { data: profile } = useProfile();
  return profile?.rol_global !== "viewer";
}

export function useIsAdmin() {
  const { data: profile } = useProfile();
  return profile?.rol_global === "admin";
}
