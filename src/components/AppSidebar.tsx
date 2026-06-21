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
  Users,
  WalletCards,
  Building2,
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

const sales = [
  { title: "Prospector", url: "/prospector", icon: Search },
  { title: "Diagnóstico", url: "/diagnostico", icon: ClipboardList },
  { title: "Presupuestos", url: "/presupuestos", icon: FileText },
  { title: "ROI Calculator", url: "/roi", icon: Calculator },
  { title: "Kit Digital", url: "/kit-digital", icon: BadgeEuro },
];

const operations = [
  { title: "FactuNexa", url: "/factunexa", icon: FileSpreadsheet },
  { title: "Pipeline", url: "/pipeline", icon: LineChart },
  { title: "Retainer", url: "/retainer", icon: BriefcaseBusiness },
];

const content = [
  { title: "SOP", url: "/sop", icon: Sparkles },
  { title: "Casos de Éxito", url: "/casos-exito", icon: Trophy },
];

const admin = [
  { title: "Ajustes", url: "/settings", icon: Settings },
  { title: "Créditos", url: "/creditos", icon: WalletCards },
];

const groups = [
  { label: "General", items: general },
  { label: "Ventas", items: sales },
  { label: "Operaciones", items: operations },
  { label: "Contenido", items: content },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: workspace } = useCurrentWorkspace();
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

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
        <SidebarMenu>
          {admin.map((it) => (
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
      </SidebarFooter>
    </Sidebar>
  );
}
