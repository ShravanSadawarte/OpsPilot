"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Ref } from "react";
import {
  ChevronDown,
  ChevronRight,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/hooks/use-sign-out";

type ShellUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type Crumb = { label: string; href?: string };

function breadcrumbsFor(pathname: string): Crumb[] {
  const workspace: Crumb = { label: "Workspace", href: "/dashboard" };

  if (pathname === "/dashboard") return [{ label: "Dashboard" }];
  if (pathname === "/work-items") {
    return [workspace, { label: "Work items" }];
  }
  if (pathname === "/work-items/create") {
    return [workspace, { label: "Work items", href: "/work-items" }, { label: "New work item" }];
  }
  if (pathname.startsWith("/work-items/")) {
    if (pathname.endsWith("/edit")) {
      return [workspace, { label: "Work items", href: "/work-items" }, { label: "Edit work item" }];
    }
    return [workspace, { label: "Work items", href: "/work-items" }, { label: "Work item details" }];
  }
  if (pathname === "/approvals") {
    return [workspace, { label: "Approvals" }];
  }
  if (pathname === "/teams") {
    return [workspace, { label: "Teams" }];
  }

  const last = pathname.split("/").filter(Boolean).at(-1) ?? "Dashboard";
  return [workspace, { label: last.replaceAll("-", " ") }];
}

export function Topbar({
  user,
  mobileOpen,
  onOpenMobile,
  menuButtonRef,
}: {
  user: ShellUser;
  mobileOpen: boolean;
  onOpenMobile: () => void;
  menuButtonRef?: Ref<HTMLButtonElement>;
}) {
  const pathname = usePathname();
  const { signOut, isSigningOut } = useSignOut();
  const crumbs = breadcrumbsFor(pathname);
  const current = crumbs.at(-1);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-8">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenMobile}
        aria-expanded={mobileOpen}
        aria-controls="mobile-navigation"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 lg:flex">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
              ) : null}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="truncate text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn(
                    "truncate text-[13px]",
                    last ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <span className="min-w-0 truncate text-[13px] font-medium text-foreground lg:hidden">
        {current?.label ?? "OpsPilot"}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/work-items/create">
            <Plus className="size-4" aria-hidden="true" />
            New item
          </Link>
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-1 pr-1 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:pr-2"
              aria-label="Open account menu"
            >
              <UserAvatar name={user.name} email={user.email} size="sm" />
              <span className="hidden max-w-[110px] truncate text-[13px] font-medium sm:block">
                {user.name ?? user.email.split("@")[0]}
              </span>
              <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            <div className="flex items-start gap-3 px-2.5 py-2">
              <UserAvatar name={user.name} email={user.email} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name ?? user.email}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {roleLabel(user.role)}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Quick links
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/work-items?assigneeId=${encodeURIComponent(user.id)}`}>
                <ListChecks aria-hidden="true" />
                My work
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/work-items/create">
                <Plus aria-hidden="true" />
                New work item
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSigningOut}
              onSelect={(event) => {
                event.preventDefault();
                void signOut();
              }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
            >
              {isSigningOut ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOut aria-hidden="true" />
              )}
              {isSigningOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
