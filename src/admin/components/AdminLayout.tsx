import { NavLink, Outlet } from "react-router-dom";
import {
  FolderOpen,
  Settings,
  ExternalLink,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "../../app/components/ui/sidebar";
import { cn } from "../../app/components/ui/utils";

const navItems = [
  { to: "/admin", icon: FolderOpen, label: "Projects", end: true },
  { to: "/admin/settings", icon: Settings, label: "Settings", end: false },
];

export function AdminLayout() {
  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="px-4 py-5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex shrink-0 items-center justify-center rounded-lg"
              style={{ width: 28, height: 28, backgroundColor: "#1A1A1A" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" />
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.5" />
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.5" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.3" />
              </svg>
            </div>
            <span className="truncate text-sm font-medium text-foreground">
              Admin Panel
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <NavLink to={item.to} end={item.end}>
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="px-4 py-3">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground",
              "transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <ExternalLink className="size-4" />
            <span className="truncate">View Portfolio</span>
          </a>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="flex h-dvh flex-col overflow-hidden">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
