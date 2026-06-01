"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "登录失败");
      setLoading(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="pl-8"
            autoComplete="username"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pl-8"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      </div>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "登录中..." : "登录"}
      </Button>
    </form>
  );
}
