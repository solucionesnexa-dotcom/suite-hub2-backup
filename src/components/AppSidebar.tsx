import { Link, useRouterState } from "@tanstack/react-router";
import {
  BadgeEuro,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Search,
  LayoutDashboard,
  LineChart,
  Settings,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  WalletCards,
  Building2,
  Receipt,
} from "lucide-react";
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

const general = [
  { title: "Panel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users },
];

const billing = [
  { title: "FactuNexa", url: "/factunexa", icon: FileSpreadsheet },
  
  { title: "Remesas", url: "/factunexa?tab=remesas", icon: Receipt },
  { title: "Retainer", url: "/retainer", icon: BriefcaseBusiness },
];

const sales = [
  { title: "Pipeline", url: "/pipeline", icon: LineChart },
  { title: "Presupuestos", url: "/presupuestos", icon: FileText },
  { title: "Prospector", url: "/prospector", icon: Search },
  { title: "ROI Calculator", url: "/roi", icon: Calculator },
  { title: "Kit Digital", url: "/kit-digital", icon: BadgeEuro },
  { title: "Diagnóstico", url: "/diagnostico", icon: ClipboardList },
];

const resources = [
  { title: "SOP", url: "/sop", icon: Sparkles },
  { title: "Casos de Éxito", url: "/casos-exito", icon: Trophy },
];

const system = [
  { title: "Ajustes", url: "/settings", icon: Settings },
  { title: "Usuarios", url: "/usuarios", icon: UserCog },
  { title: "Créditos", url: "/creditos", icon: WalletCards },
];

const groups = [
  { label: "General", items: general },
  { label: "Facturación", items: billing },
  { label: "Ventas", items: sales },
  { label: "Recursos", items: resources },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: workspace } = useCurrentWorkspace();

  const isActive = (url: string) => {
    const cleanUrl = url.split("?")[0];
    return pathname === cleanUrl || pathname.startsWith(cleanUrl + "/");
  };

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
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((it) => (
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
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {system.map((it) => (
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
      </SidebarFooter>
    </Sidebar>
  );
}