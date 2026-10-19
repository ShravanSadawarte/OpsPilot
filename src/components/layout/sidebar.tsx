"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  FileText,
  Users,
  ShieldAlert,
  Clock,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/work-items", label: "Work Items", icon: List },
  { href: "/approvals", label: "Approvals", icon: FileText },
  { href: "/teams", label: "Teams", icon: Users },
];

export function Sidebar({ user }: { user: { name: string | null; email: string; role: string } }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r border-border bg-background flex flex-col z-20">
      <div className="h-16 flex items-center gap-3 px-5">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
          OP
        </div>
        <span className="font-semibold text-lg tracking-tight">OpsPilot</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 mb-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name ?? user.email)}&background=random`} alt="" />
            <AvatarFallback>
              {user.name ? user.name[0] : user.email[0]}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</p>
            <Badge variant="outline" className="mt-1 text-[10px]">{user.role}</Badge>
          </div>
        </div>
        <Button
          onClick={() => {
            apiFetch("/api/v1/auth/logout", { method: "POST" }).then(() => {
              window.location.href = "/login";
            });
          }}
          variant="destructive"
          size="sm"
          className="w-full"
        >
          <LogOut className="size-4 mr-2" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
