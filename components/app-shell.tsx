"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, GitBranch, LayoutDashboard, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/global-search";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";

type PoolNavItem = {
  id: number;
  name: string;
  slug: string;
};

type AppShellProps = {
  user: {
    username: string;
    role: string;
  };
  pools: PoolNavItem[];
  children: React.ReactNode;
};

export function AppShell({ user, pools, children }: AppShellProps) {
  const pathname = usePathname();

  const baseLinks = [
    { href: "/dashboard", label: "总览", icon: LayoutDashboard },
    { href: "/relations", label: "关联查询", icon: GitBranch }
  ];

  const adminLinks =
    user.role === "ADMIN"
      ? [
          { href: "/admin/pools", label: "池子管理", icon: ShieldCheck },
          { href: "/admin/resources", label: "资源管理", icon: Boxes }
        ]
      : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 text-base font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                RP
              </span>
              <span>资源池管理平台</span>
            </Link>
            <Badge variant={user.role === "ADMIN" ? "default" : "muted"}>{user.role}</Badge>
          </div>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {[...baseLinks, ...adminLinks].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    pathname === item.href && "bg-muted text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            {pools.map((pool) => (
              <Link
                key={pool.id}
                href={`/pools/${pool.id}`}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  pathname === `/pools/${pool.id}` && "bg-muted text-foreground"
                )}
              >
                {pool.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <GlobalSearch />
            <Link
              href="/settings"
              className="hidden h-9 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              {user.username}
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
    </div>
  );
}
