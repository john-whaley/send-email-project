import { Shield, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="用户中心" description="当前登录账号和权限信息。" />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>账号信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              用户名
            </span>
            <span className="text-sm font-medium">{user.username}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" aria-hidden="true" />
              角色
            </span>
            <Badge variant={user.role === "ADMIN" ? "default" : "muted"}>{user.role}</Badge>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
