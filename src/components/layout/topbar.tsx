"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({ user }: { user: { name: string | null; email: string; role: string } }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-background bg-background/95 backdrop-blur px-4">
      <button className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden" aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
        <span className="mr-2 hidden sm:inline">OpsPilot</span>
      </Link>
      <div className="ml-auto flex items-center gap-3">
        <button className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Theme">
          <Sun className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-input bg-secondary px-2.5 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
            <span className="hidden sm:inline">{user.name}</span>
            <span className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">
              {user.name ? user.name[0] : user.email?.[0]}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs font-medium">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm">
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                fetch("/api/v1/auth/logout", { method: "POST" }).then(() => {
                  window.location.href = "/login";
                });
              }}
              className="text-sm text-destructive"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
