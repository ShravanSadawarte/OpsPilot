"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/status";
import { BrandLockup, BrandMark } from "@/components/brand";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useSignOut } from "@/hooks/use-sign-out";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/work-items", label: "Work items", icon: ListChecks },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/teams", label: "Teams", icon: Users },
] as const;

type ShellUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type SidebarContentProps = {
  user: ShellUser;
  collapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  onCloseMobile?: () => void;
  onToggleCollapsed?: () => void;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  user,
  collapsed,
  mobile = false,
  onNavigate,
  onCloseMobile,
  onToggleCollapsed,
}: SidebarContentProps) {
  const pathname = usePathname();
  const { signOut, isSigningOut } = useSignOut();

  return (
    <>
      <div
        className={cn(
          "flex h-[68px] shrink-0 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-3" : "justify-between px-4",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
          aria-label="OpsPilot dashboard"
        >
          {collapsed ? (
            <BrandMark />
          ) : (
            <BrandLockup
              textClassName="text-white"
              subtitle="Operations"
              className="min-w-0"
            />
          )}
        </Link>
        {mobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            autoFocus
            className="grid size-8 place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close navigation"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2.5 py-4">
        {!collapsed ? (
          <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted/80">
            Workspace
          </p>
        ) : null}
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex items-center rounded-lg py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                    collapsed ? "justify-center px-0" : "gap-3 px-3",
                    active
                      ? "bg-sidebar-active text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "text-sidebar-muted hover:bg-white/[0.05] hover:text-sidebar-foreground",
                  )}
                >
                  {active ? (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Icon
                    className={cn("size-[18px] shrink-0", active ? "text-white" : "text-sidebar-muted")}
                    aria-hidden="true"
                  />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center gap-2.5",
            collapsed ? "justify-center" : "rounded-lg bg-white/[0.035] px-2.5 py-2",
          )}
        >
          <UserAvatar name={user.name} email={user.email} size="sm" />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user.name ?? user.email}</p>
              <p className="truncate text-[10px] text-sidebar-muted">{roleLabel(user.role)}</p>
            </div>
          ) : null}
        </div>

        <div className={cn("mt-2 flex gap-1", collapsed && "flex-col")}>
          <button
            type="button"
            onClick={signOut}
            disabled={isSigningOut}
            title="Sign out"
            className={cn(
              "flex h-8 items-center justify-center gap-2 rounded-lg text-[11px] font-medium text-sidebar-muted transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-60",
              collapsed ? "w-full" : "flex-1 px-2",
            )}
          >
            {isSigningOut ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-3.5" aria-hidden="true" />
            )}
            {!collapsed ? <span>Sign out</span> : <span className="sr-only">Sign out</span>}
          </button>

          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex h-8 items-center justify-center gap-2 rounded-lg text-[11px] font-medium text-sidebar-muted transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                collapsed ? "w-full" : "flex-1 px-2",
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-3.5" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-3.5" aria-hidden="true" />
              )}
              {!collapsed ? <span>Collapse</span> : <span className="sr-only">Expand sidebar</span>}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function Sidebar({
  user,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapsed,
}: {
  user: ShellUser;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:flex",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
        aria-label="Sidebar"
      >
        <SidebarContent
          user={user}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            tabIndex={-1}
            aria-label="Close navigation"
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="animate-enter absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col border-r border-sidebar-border bg-sidebar shadow-float"
          >
            <SidebarContent
              user={user}
              collapsed={false}
              mobile
              onNavigate={onCloseMobile}
              onCloseMobile={onCloseMobile}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
