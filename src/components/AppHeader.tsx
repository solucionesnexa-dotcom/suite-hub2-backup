import { useNavigate } from "@tanstack/react-router";
import nexaLogo from "@/assets/nexa-logo.png.asset.json";
import { LogOut, User as UserIcon, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { getCreditBalance } from "@/lib/nexa";

const roleLabels = { admin: "Admin", consultor: "Consultor", viewer: "Viewer" } as const;

export function AppHeader({ title }: { title?: string }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: ws } = useCurrentWorkspace();
  const { data: credits } = useQuery({
    queryKey: ["credit-balance", ws?.id],
    enabled: !!ws,
    queryFn: () => getCreditBalance(ws!.id),
  });

  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <img src={nexaLogo.url} alt="Nexa" className="h-8 w-auto mr-2 hidden sm:inline" />
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="text-sm font-medium text-foreground">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {typeof credits === "number" && (
          <Badge variant={credits < 5 ? "destructive" : "secondary"} className="gap-1">
            <WalletCards className="h-3 w-3" />
            {credits}
          </Badge>
        )}
        {profile?.rol_global && (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {roleLabels[profile.rol_global]}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">{user?.email}</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user?.user_metadata?.full_name ?? "Usuario"}
                </span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
              <UserIcon className="mr-2 h-4 w-4" /> Mi cuenta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
