"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { GitBranch, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ResourceField, ResourceItem, ResourcePool } from "@/components/resources/resource-manager";
import { maskSensitiveValue } from "@/lib/resource";
import { formatDateTime } from "@/lib/utils";

type PoolWithItems = ResourcePool & {
  items: ResourceItem[];
};

type RelationResult = {
  relationId: number;
  id: number;
  poolId: number;
  poolName: string;
  data: Record<string, unknown>;
  displayName: string;
  createdAt: string;
  note?: string | null;
};

function renderValue(field: ResourceField, data: Record<string, unknown>) {
  const value = maskSensitiveValue(field.fieldName, data[field.fieldName]);

  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  if (field.fieldType === "BOOLEAN") {
    return value ? "是" : "否";
  }

  if (typeof value === "object") {
    return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
  }

  return String(value);
}

export function RelationExplorer({ pools, canManage }: { pools: PoolWithItems[]; canManage: boolean }) {
  const router = useRouter();
  const [sourcePoolId, setSourcePoolId] = useState<number | null>(pools[0]?.id ?? null);
  const [sourceItemId, setSourceItemId] = useState<number | null>(pools[0]?.items[0]?.id ?? null);
  const [targetPoolId, setTargetPoolId] = useState<number | null>(pools[1]?.id ?? pools[0]?.id ?? null);
  const [targetItemId, setTargetItemId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<RelationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const sourcePool = useMemo(() => pools.find((pool) => pool.id === sourcePoolId) ?? null, [pools, sourcePoolId]);
  const targetPool = useMemo(() => pools.find((pool) => pool.id === targetPoolId) ?? null, [pools, targetPoolId]);

  const availableTargetItems = useMemo(() => {
    if (!targetPool) {
      return [];
    }

    const relatedIds = new Set(items.map((item) => item.id));
    return targetPool.items.filter((item) => item.id !== sourceItemId && !relatedIds.has(item.id));
  }, [items, sourceItemId, targetPool]);

  useEffect(() => {
    if (!sourcePool) {
      setSourceItemId(null);
      return;
    }

    setSourceItemId(sourcePool.items[0]?.id ?? null);
  }, [sourcePoolId, sourcePool]);

  useEffect(() => {
    setTargetItemId(availableTargetItems[0]?.id ?? null);
  }, [availableTargetItems]);

  useEffect(() => {
    if (!sourcePoolId || !sourceItemId || !targetPoolId) {
      setItems([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      sourcePoolId: String(sourcePoolId),
      sourceItemId: String(sourceItemId),
      targetPoolId: String(targetPoolId)
    });

    if (query.trim()) {
      params.set("q", query.trim());
    }

    setLoading(true);
    fetch(`/api/relations?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        setItems(result.items ?? []);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [sourcePoolId, sourceItemId, targetPoolId, query, refreshKey]);

  async function handleCreateRelation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sourcePoolId || !sourceItemId || !targetPoolId || !targetItemId) {
      setMessage("请选择完整的主对象和副对象");
      return;
    }

    setMessage("");
    const response = await fetch("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourcePoolId,
        sourceItemId,
        targetPoolId,
        targetItemId
      })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "建立关联失败");
      return;
    }

    setMessage("关联已建立");
    router.refresh();
    setRefreshKey((current) => current + 1);
  }

  async function handleDeleteRelation(relationId: number) {
    if (!window.confirm("确认删除这条关联？")) {
      return;
    }

    const response = await fetch(`/api/relations/${relationId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "删除关联失败");
      return;
    }

    setItems((current) => current.filter((item) => item.relationId !== relationId));
    router.refresh();
  }

  if (!pools.length) {
    return <EmptyState title="还没有资源池" description="请先创建池子并录入资源。" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="source-pool">主池类型</Label>
              <Select id="source-pool" value={String(sourcePoolId ?? "")} onChange={(event) => setSourcePoolId(Number(event.target.value))}>
                {pools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-item">主对象</Label>
              <Select id="source-item" value={String(sourceItemId ?? "")} onChange={(event) => setSourceItemId(Number(event.target.value))}>
                {sourcePool?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-pool">副池类型</Label>
              <Select id="target-pool" value={String(targetPoolId ?? "")} onChange={(event) => setTargetPoolId(Number(event.target.value))}>
                {pools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">查询结果</h2>
            <p className="text-sm text-muted-foreground">{loading ? "查询中..." : `${items.length} 条关联资源`}</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="实时搜索结果" className="pl-8" />
          </div>
        </div>

        {targetPool && items.length ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {targetPool.fields.map((field) => (
                    <TableHead key={field.id}>{field.label || field.fieldName}</TableHead>
                  ))}
                  <TableHead>建立时间</TableHead>
                  {canManage ? <TableHead className="w-16 text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.relationId}>
                    {targetPool.fields.map((field) => (
                      <TableCell key={field.id} className="max-w-64 truncate">
                        {renderValue(field, item.data)}
                      </TableCell>
                    ))}
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRelation(item.relationId)} title="删除关联" aria-label="删除关联">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState title="没有关联结果" description="可以切换主对象、副池类型，或由管理员建立新的关联。" />
        )}
      </section>

      {canManage ? (
        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                建立关联
              </CardTitle>
              <CardDescription>将当前主对象关联到副池中的一个资源。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateRelation} className="space-y-4">
                <div className="space-y-2">
                  <Label>当前主对象</Label>
                  <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                    <span>{sourcePool?.name}</span>
                    <span className="mx-2 text-muted-foreground">/</span>
                    <span>{sourcePool?.items.find((item) => item.id === sourceItemId)?.displayName ?? "-"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-item">副对象</Label>
                  <Select id="target-item" value={String(targetItemId ?? "")} onChange={(event) => setTargetItemId(Number(event.target.value))}>
                    {availableTargetItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
                {message ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
                <Button type="submit" disabled={!availableTargetItems.length}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  建立关联
                </Button>
              </form>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">{sourcePool?.name ?? "-"}</Badge>
                <Badge variant="secondary">{targetPool?.name ?? "-"}</Badge>
              </div>
            </CardContent>
          </Card>
        </aside>
      ) : null}
    </div>
  );
}
