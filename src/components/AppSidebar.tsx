import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, FileSpreadsheet, Settings, Building2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useProfile } from "@/hooks/useProfile";

const general = [
  { title: "Panel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users },
];

const modules = [{ title: "FactuNexa", url: "/factu-nexa", icon: FileSpreadsheet }];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: workspace } = useCurrentWorkspace();
  const { data: profile } = useProfile();
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");
  const canSeeSettings = profile?.rol_global !== "viewer";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            N
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">Nexa Suite</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {workspace?.name ?? "—"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {general.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)} tooltip={it.title}>
                    <Link to={it.url}>
                      <it.icon />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)} tooltip={it.title}>
                    <Link to={it.url}>
                      <it.icon />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {canSeeSettings && (
        <SidebarFooter className="border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Configuración">
                <Link to="/settings">
                  <Settings />
                  <span>Configuración</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
