"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="icon" onClick={handleLogout} title="退出登录" aria-label="退出登录">
      <LogOut className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
