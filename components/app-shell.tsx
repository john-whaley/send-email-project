"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, GitBranch, LayoutDashboard, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  POOL_ORDER_CHANGED_EVENT,
  POOL_ORDER_STORAGE_KEY,
  orderPoolsByStoredOrder,
  parseStoredPoolOrder
} from "@/lib/pool-order";
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

const LONG_PRESS_DELAY_MS = 150;

export function AppShell({ user, pools, children }: AppShellProps) {
  const pathname = usePathname();
  const [poolOrder, setPoolOrder] = useState<number[]>([]);
  const [draggingPoolId, setDraggingPoolId] = useState<number | null>(null);
  const [pressedPoolId, setPressedPoolId] = useState<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const orderedPools = useMemo(() => orderPoolsByStoredOrder(pools, poolOrder), [poolOrder, pools]);

  useEffect(() => {
    function syncPoolOrder() {
      setPoolOrder(parseStoredPoolOrder(window.localStorage.getItem(POOL_ORDER_STORAGE_KEY)));
    }

    syncPoolOrder();
    window.addEventListener("storage", syncPoolOrder);
    window.addEventListener(POOL_ORDER_CHANGED_EVENT, syncPoolOrder);
    return () => {
      window.removeEventListener("storage", syncPoolOrder);
      window.removeEventListener(POOL_ORDER_CHANGED_EVENT, syncPoolOrder);
    };
  }, []);

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function savePoolOrder(nextOrder: number[]) {
    window.localStorage.setItem(POOL_ORDER_STORAGE_KEY, JSON.stringify(nextOrder));
    window.dispatchEvent(new Event(POOL_ORDER_CHANGED_EVENT));
  }

  function normalizeCurrentPoolOrder() {
    return orderedPools.map((pool) => pool.id);
  }

  function handlePoolPointerDown(poolId: number) {
    clearLongPressTimer();
    isDraggingRef.current = false;
    setPressedPoolId(poolId);
    longPressTimerRef.current = window.setTimeout(() => {
      isDraggingRef.current = true;
      setDraggingPoolId(poolId);
    }, LONG_PRESS_DELAY_MS);
  }

  function handlePoolPointerEnd() {
    clearLongPressTimer();
    setPressedPoolId(null);
    setDraggingPoolId(null);

    window.setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
  }

  function handlePoolClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isDraggingRef.current) {
      event.preventDefault();
    }
  }

  function moveDraggingPool(targetPoolId: number) {
    if (!draggingPoolId || draggingPoolId === targetPoolId) {
      return;
    }

    const currentOrder = normalizeCurrentPoolOrder();
    const fromIndex = currentOrder.indexOf(draggingPoolId);
    const toIndex = currentOrder.indexOf(targetPoolId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const nextOrder = [...currentOrder];
    const [movedId] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, movedId);
    setPoolOrder(nextOrder);
    savePoolOrder(nextOrder);
  }

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
            {orderedPools.map((pool) => (
              <Link
                key={pool.id}
                href={`/pools/${pool.id}`}
                draggable={false}
                onClick={handlePoolClick}
                onPointerDown={() => handlePoolPointerDown(pool.id)}
                onPointerUp={handlePoolPointerEnd}
                onPointerCancel={handlePoolPointerEnd}
                onPointerLeave={() => {
                  if (!draggingPoolId) {
                    clearLongPressTimer();
                    setPressedPoolId(null);
                  }
                }}
                onPointerEnter={() => moveDraggingPool(pool.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 select-none items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing",
                  pathname === `/pools/${pool.id}` && "bg-muted text-foreground",
                  pressedPoolId === pool.id && !draggingPoolId && "bg-muted/70 text-foreground",
                  draggingPoolId === pool.id && "cursor-grabbing bg-primary text-primary-foreground shadow-sm",
                  draggingPoolId && draggingPoolId !== pool.id && "cursor-grab"
                )}
                aria-grabbed={draggingPoolId === pool.id}
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
