import {
  LayoutDashboard,
  Package,
  Search,
  AlertTriangle,
  Brain,
  Clock,
  FileText,
  Shield,
  Upload,
  Bot,
  Activity,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const systemItems = [
  { title: "AI Assistant", url: "/", icon: Bot },
  { title: "Agent Activity", url: "/agents", icon: Activity },
  { title: "Upload Documents", url: "/upload", icon: Upload },
  { title: "Documents", url: "/documents", icon: FileText },
];

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Parts & Suppliers", url: "/parts", icon: Package },
  { title: "Inspections", url: "/inspections", icon: Search },
  { title: "Nonconformances", url: "/ncrs", icon: AlertTriangle },
  { title: "CAPA", url: "/capa", icon: Brain },
  { title: "Compliance", url: "/compliance", icon: Clock },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const organizationLabel = user?.organizationName || user?.organizationId;
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Shield className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-white">
                Inspectra
              </span>
              {organizationLabel && (
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-primary">
                  {organizationLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-widest">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-primary">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-widest">
            Quality Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-primary">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/50 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-status-success status-pulse" />
              <span className="text-[11px] text-sidebar-foreground/70">
                All agents active
              </span>
            </div>
            <div className="rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2">
              <div className="text-[11px] font-medium text-sidebar-foreground">
                {user?.name || user?.email || "Authenticated User"}
              </div>
              {organizationLabel && (
                <div className="text-[10px] text-sidebar-foreground/60">
                  Workspace: {organizationLabel}
                </div>
              )}
              {user?.email && (
                <div className="text-[10px] text-sidebar-foreground/60">{user.email}</div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 w-full border-sidebar-border bg-transparent text-[11px] text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => void signOut()}
              >
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
