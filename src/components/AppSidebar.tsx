import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Clock, LayoutDashboard, FileText, Users, Building2,
  FolderKanban, LinkIcon, BarChart3, LogOut, ChevronLeft, ChevronRight, Menu, X, Settings, Receipt
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const workNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/timesheet", label: "Timesheet", icon: FileText },
];

const accountNav = [
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { to: "/admin", label: "Overview", icon: BarChart3 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/clients", label: "Clients", icon: Building2 },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/assignments", label: "Assignments", icon: LinkIcon },
  { to: "/admin/entries", label: "All Entries", icon: Clock },
  { to: "/admin/invoices", label: "Invoices", icon: Receipt },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = role === "admin";

  const isActiveLink = (to: string) =>
    location.pathname === to ||
    (to !== "/dashboard" && to !== "/admin" && location.pathname.startsWith(to));

  const initials = (profile?.full_name || profile?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const renderGroup = (label: string, items: typeof workNav) => (
    <div className="px-2">
      {!collapsed && (
        <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isActiveLink(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              } ${collapsed ? "justify-center px-2" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );

  const sidebar = (
    <div
      className={`flex flex-col h-full bg-sidebar rounded-2xl shadow-[var(--shadow-float)] border border-sidebar-border/60 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/15 text-primary grid place-items-center">
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">TimeTrack</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-sidebar-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {renderGroup("Work", workNav)}
        {isAdmin && renderGroup("Admin", adminNav)}
        {renderGroup("Account", accountNav)}
      </nav>

      <div className="border-t border-sidebar-border/60 p-3">
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="w-full text-muted-foreground hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{profile?.full_name || profile?.email}</p>
              {profile?.full_name && (
                <p className="text-[11px] text-muted-foreground truncate">{profile.email}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
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
          <div className="relative z-50 h-full p-2">{sidebar}</div>
        </div>
      )}

      <div className="hidden md:flex h-screen sticky top-0 p-3">{sidebar}</div>
    </>
  );
}
