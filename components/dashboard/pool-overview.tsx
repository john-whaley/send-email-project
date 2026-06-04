"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 100;

export type DashboardPoolOverviewItem = {
  id: number;
  name: string;
  description: string | null;
  fieldCount: number;
  itemCount: number;
  relationCount: number;
};

function normalizePageSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

export function DashboardPoolOverview({ pools }: { pools: DashboardPoolOverviewItem[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const pageCount = Math.max(1, Math.ceil(pools.length / pageSize));
  const normalizedPage = Math.min(page, pageCount);
  const pagedPools = pools.slice((normalizedPage - 1) * pageSize, normalizedPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">资源池</h2>
          <p className="text-sm text-muted-foreground">{pools.length} 个池子</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="dashboard-pool-page-size" className="whitespace-nowrap text-muted-foreground">
              每页
            </Label>
            <Input
              id="dashboard-pool-page-size"
              type="number"
              min={1}
              max={MAX_PAGE_SIZE}
              value={pageSize}
              onChange={(event) => setPageSize(normalizePageSize(Number(event.target.value)))}
              className="h-9 w-20"
            />
            <span className="whitespace-nowrap text-muted-foreground">条</span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/pools">管理</Link>
          </Button>
        </div>
      </div>

      {pools.length ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {pagedPools.map((pool) => (
              <Card key={pool.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>{pool.name}</span>
                    <Badge variant="muted">{pool.itemCount} 条</Badge>
                  </CardTitle>
                  <CardDescription>{pool.description || "未填写描述"}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    字段 {pool.fieldCount} 个，关联 {pool.relationCount} 条
                  </span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/pools/${pool.id}`}>打开</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              第 {normalizedPage} / {pageCount} 页，每页 {pageSize} 条
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={normalizedPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={normalizedPage >= pageCount}
              >
                下一页
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">暂无资源池</p>
      )}
    </div>
  );
}
