import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Clock, LayoutDashboard, CalendarDays, FileText, Users, Building2,
  FolderKanban, LinkIcon, BarChart3, LogOut, ChevronLeft, ChevronRight, Menu, X, Settings
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const freelancerNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/timesheet", label: "Timesheet", icon: FileText },
  { to: "/weekly", label: "Weekly View", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { to: "/admin", label: "Admin Dashboard", icon: BarChart3 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/clients", label: "Clients", icon: Building2 },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/assignments", label: "Assignments", icon: LinkIcon },
  { to: "/admin/entries", label: "All Entries", icon: Clock },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = role === "admin";
  const navItems = isAdmin ? [...freelancerNav, ...adminNav] : freelancerNav;

  const sidebar = (
    <div className={`flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ${collapsed ? "w-16" : "w-60"}`}>
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">TimeTrack</span>}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="hidden md:flex text-sidebar-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="md:hidden text-sidebar-foreground">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== "/dashboard" && item.to !== "/admin" && location.pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        {!collapsed && profile && (
          <p className="text-xs text-muted-foreground mb-2 truncate">{profile.full_name || profile.email}</p>
        )}
        <Button variant="ghost" size={collapsed ? "icon" : "sm"} onClick={signOut} className="w-full text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="fixed top-3 left-3 z-50 md:hidden">
        <Menu className="h-5 w-5" />
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 h-full w-60">{sidebar}</div>
        </div>
      )}

      <div className="hidden md:flex h-screen sticky top-0">{sidebar}</div>
    </>
  );
}
