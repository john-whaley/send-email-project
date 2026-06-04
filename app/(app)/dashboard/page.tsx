import Link from "next/link";
import { ArrowRight, Boxes, Database, GitBranch, Users } from "lucide-react";
import { DashboardPoolOverview } from "@/components/dashboard/pool-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getItemDisplayName } from "@/lib/resource";
import { formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const [poolCount, itemCount, relationCount, userCount, pools, recentItems] = await Promise.all([
    prisma.pool.count(),
    prisma.poolItem.count(),
    prisma.relation.count(),
    prisma.user.count(),
    prisma.pool.findMany({
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        _count: { select: { items: true, sourceRelations: true, targetRelations: true } }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.poolItem.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: {
        pool: { include: { fields: { orderBy: { sortOrder: "asc" } } } }
      }
    })
  ]);

  const stats = [
    { label: "资源池", value: poolCount, icon: Database },
    { label: "资源", value: itemCount, icon: Boxes },
    { label: "关联", value: relationCount, icon: GitBranch },
    { label: "用户", value: userCount, icon: Users }
  ];
  const poolOverviewItems = pools.map((pool) => ({
    id: pool.id,
    name: pool.name,
    description: pool.description,
    fieldCount: pool.fields.length,
    itemCount: pool._count.items,
    relationCount: pool._count.sourceRelations + pool._count.targetRelations
  }));

  return (
    <>
      <PageHeader
        title="总览"
        description="动态资源池、字段配置、资源实体和通用关联关系的集中入口。"
        actions={
          <Button asChild>
            <Link href="/relations">
              关联查询
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <DashboardPoolOverview pools={poolOverviewItems} />

        <div className="space-y-3">
          <h2 className="text-base font-semibold">最近更新</h2>
          <div className="rounded-lg border bg-card">
            {recentItems.length ? (
              <div className="divide-y">
                {recentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/pools/${item.poolId}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{getItemDisplayName(item, item.pool.fields)}</p>
                      <p className="text-xs text-muted-foreground">{item.pool.name}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">暂无资源</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
