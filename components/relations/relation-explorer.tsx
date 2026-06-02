"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Link2, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type RelatedItem = {
  relationId: number;
  id: number;
  poolId: number;
  poolName: string;
  data: Record<string, unknown>;
  displayName: string;
  createdAt: string;
  note?: string | null;
};

type UnrelatedItem = {
  id: number;
  poolId: number;
  data: Record<string, unknown>;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 10;

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

function itemMatchesQuery(item: Pick<RelatedItem | UnrelatedItem, "displayName" | "data">, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return `${item.displayName} ${JSON.stringify(item.data)}`.toLowerCase().includes(normalizedQuery);
}

export function RelationExplorer({ pools, canManage }: { pools: PoolWithItems[]; canManage: boolean }) {
  const router = useRouter();
  const [sourcePoolId, setSourcePoolId] = useState<number | null>(pools[0]?.id ?? null);
  const [sourceItemId, setSourceItemId] = useState<number | null>(pools[0]?.items[0]?.id ?? null);
  const [targetPoolId, setTargetPoolId] = useState<number | null>(pools[1]?.id ?? pools[0]?.id ?? null);
  const [relatedQuery, setRelatedQuery] = useState("");
  const [unrelatedQuery, setUnrelatedQuery] = useState("");
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [unrelatedItems, setUnrelatedItems] = useState<UnrelatedItem[]>([]);
  const [selectedUnrelatedIds, setSelectedUnrelatedIds] = useState<Set<number>>(new Set());
  const [unrelatedPage, setUnrelatedPage] = useState(1);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loadingUnrelated, setLoadingUnrelated] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const sourcePool = useMemo(() => pools.find((pool) => pool.id === sourcePoolId) ?? null, [pools, sourcePoolId]);
  const targetPool = useMemo(() => pools.find((pool) => pool.id === targetPoolId) ?? null, [pools, targetPoolId]);
  const sourceItem = useMemo(
    () => sourcePool?.items.find((item) => item.id === sourceItemId) ?? null,
    [sourceItemId, sourcePool]
  );

  const filteredRelatedItems = useMemo(
    () => relatedItems.filter((item) => itemMatchesQuery(item, relatedQuery)),
    [relatedItems, relatedQuery]
  );

  const filteredUnrelatedItems = useMemo(
    () => unrelatedItems.filter((item) => itemMatchesQuery(item, unrelatedQuery)),
    [unrelatedItems, unrelatedQuery]
  );

  const unrelatedPageCount = Math.max(1, Math.ceil(filteredUnrelatedItems.length / PAGE_SIZE));
  const normalizedUnrelatedPage = Math.min(unrelatedPage, unrelatedPageCount);
  const pagedUnrelatedItems = filteredUnrelatedItems.slice(
    (normalizedUnrelatedPage - 1) * PAGE_SIZE,
    normalizedUnrelatedPage * PAGE_SIZE
  );
  const selectedCount = selectedUnrelatedIds.size;
  const pageSelected =
    pagedUnrelatedItems.length > 0 && pagedUnrelatedItems.every((item) => selectedUnrelatedIds.has(item.id));

  useEffect(() => {
    if (!sourcePool) {
      setSourceItemId(null);
      return;
    }

    setSourceItemId(sourcePool.items[0]?.id ?? null);
  }, [sourcePoolId, sourcePool]);

  useEffect(() => {
    setUnrelatedPage(1);
    setSelectedUnrelatedIds(new Set());
  }, [sourcePoolId, sourceItemId, targetPoolId, unrelatedQuery]);

  useEffect(() => {
    if (!sourcePoolId || !sourceItemId || !targetPoolId) {
      setRelatedItems([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      sourcePoolId: String(sourcePoolId),
      sourceItemId: String(sourceItemId),
      targetPoolId: String(targetPoolId)
    });

    if (relatedQuery.trim()) {
      params.set("q", relatedQuery.trim());
    }

    setLoadingRelated(true);
    fetch(`/api/relations?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        setRelatedItems(result.items ?? []);
        setLoadingRelated(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setLoadingRelated(false);
        }
      });

    return () => controller.abort();
  }, [sourcePoolId, sourceItemId, targetPoolId, relatedQuery, refreshKey]);

  useEffect(() => {
    if (!sourcePoolId || !sourceItemId || !targetPoolId) {
      setUnrelatedItems([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      sourcePoolId: String(sourcePoolId),
      sourceItemId: String(sourceItemId),
      targetPoolId: String(targetPoolId)
    });

    setLoadingUnrelated(true);
    fetch(`/api/relations/unrelated?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        setUnrelatedItems(result.items ?? []);
        setLoadingUnrelated(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setLoadingUnrelated(false);
        }
      });

    return () => controller.abort();
  }, [sourcePoolId, sourceItemId, targetPoolId, refreshKey]);

  function toggleSelected(itemId: number, checked: boolean) {
    setSelectedUnrelatedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }

      return next;
    });
  }

  function togglePageSelected(checked: boolean) {
    setSelectedUnrelatedIds((current) => {
      const next = new Set(current);

      for (const item of pagedUnrelatedItems) {
        if (checked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      }

      return next;
    });
  }

  async function createRelation(targetItemId: number) {
    if (!sourcePoolId || !sourceItemId || !targetPoolId) {
      throw new Error("请选择完整的主对象和副池类型");
    }

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
      throw new Error(result.error ?? "建立关联失败");
    }

    return result.relation as { id: number; createdAt: string };
  }

  async function handleLinkOne(item: UnrelatedItem) {
    try {
      setMessage("");
      const relation = await createRelation(item.id);
      setUnrelatedItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setSelectedUnrelatedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      setRelatedItems((current) => [
        {
          relationId: relation.id,
          id: item.id,
          poolId: item.poolId,
          poolName: targetPool?.name ?? "",
          data: item.data,
          displayName: item.displayName,
          createdAt: relation.createdAt
        },
        ...current
      ]);
      setMessage("关联已建立");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立关联失败");
    }
  }

  async function handleBatchLink() {
    const selectedItems = unrelatedItems.filter((item) => selectedUnrelatedIds.has(item.id));

    if (!selectedItems.length) {
      setMessage("请先勾选未关联对象");
      return;
    }

    try {
      setMessage("");
      const created = await Promise.all(
        selectedItems.map(async (item) => ({
          item,
          relation: await createRelation(item.id)
        }))
      );

      const createdIds = new Set(created.map(({ item }) => item.id));
      setUnrelatedItems((current) => current.filter((item) => !createdIds.has(item.id)));
      setSelectedUnrelatedIds(new Set());
      setRelatedItems((current) => [
        ...created.map(({ item, relation }) => ({
          relationId: relation.id,
          id: item.id,
          poolId: item.poolId,
          poolName: targetPool?.name ?? "",
          data: item.data,
          displayName: item.displayName,
          createdAt: relation.createdAt
        })),
        ...current
      ]);
      setMessage(`已批量关联 ${created.length} 个对象`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批量关联失败");
      setRefreshKey((current) => current + 1);
    }
  }

  async function handleDeleteRelation(item: RelatedItem) {
    if (!window.confirm(`确认删除 ${item.displayName} 的关联？`)) {
      return;
    }

    const response = await fetch(`/api/relations/${item.relationId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "删除关联失败");
      return;
    }

    setRelatedItems((current) => current.filter((candidate) => candidate.relationId !== item.relationId));
    setUnrelatedItems((current) => [
      {
        id: item.id,
        poolId: item.poolId,
        data: item.data,
        displayName: item.displayName
      },
      ...current
    ]);
    setMessage("关联已删除");
    router.refresh();
  }

  if (!pools.length) {
    return <EmptyState title="还没有资源池" description="请先创建池子并录入资源。" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-4">
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
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{sourcePool?.name ?? "-"}</Badge>
          <span>{sourceItem?.displayName ?? "-"}</span>
          <span>关联到</span>
          <Badge variant="secondary">{targetPool?.name ?? "-"}</Badge>
        </div>
      </section>

      {message ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">已关联对象</h2>
            <p className="text-sm text-muted-foreground">
              {loadingRelated ? "查询中..." : `${filteredRelatedItems.length} 条已关联对象`}
            </p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input value={relatedQuery} onChange={(event) => setRelatedQuery(event.target.value)} placeholder="搜索已关联对象" className="pl-8" />
          </div>
        </div>

        {targetPool && filteredRelatedItems.length ? (
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
                {filteredRelatedItems.map((item) => (
                  <TableRow key={item.relationId}>
                    {targetPool.fields.map((field) => (
                      <TableCell key={field.id} className="max-w-64 truncate">
                        {renderValue(field, item.data)}
                      </TableCell>
                    ))}
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRelation(item)} title="删除关联" aria-label="删除关联">
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
          <EmptyState title="没有已关联对象" description="可以从下方未关联对象中快速建立关联。" />
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">未关联对象</h2>
            <p className="text-sm text-muted-foreground">
              {loadingUnrelated ? "查询中..." : `${filteredUnrelatedItems.length} 条未关联对象`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input value={unrelatedQuery} onChange={(event) => setUnrelatedQuery(event.target.value)} placeholder="搜索未关联对象" className="pl-8" />
            </div>
            {canManage ? (
              <Button onClick={handleBatchLink} disabled={!selectedCount}>
                <Link2 className="h-4 w-4" aria-hidden="true" />
                批量关联{selectedCount ? ` ${selectedCount}` : ""}
              </Button>
            ) : null}
          </div>
        </div>

        {targetPool && pagedUnrelatedItems.length ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage ? (
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={pageSelected}
                        onChange={(event) => togglePageSelected(event.target.checked)}
                        aria-label="勾选当前页"
                      />
                    </TableHead>
                  ) : null}
                  {targetPool.fields.map((field) => (
                    <TableHead key={field.id}>{field.label || field.fieldName}</TableHead>
                  ))}
                  {canManage ? <TableHead className="w-24 text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedUnrelatedItems.map((item) => (
                  <TableRow key={item.id}>
                    {canManage ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedUnrelatedIds.has(item.id)}
                          onChange={(event) => toggleSelected(item.id, event.target.checked)}
                          aria-label={`勾选 ${item.displayName}`}
                        />
                      </TableCell>
                    ) : null}
                    {targetPool.fields.map((field) => (
                      <TableCell key={field.id} className="max-w-64 truncate">
                        {renderValue(field, item.data)}
                      </TableCell>
                    ))}
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleLinkOne(item)}>
                          <Link2 className="h-4 w-4" aria-hidden="true" />
                          关联
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                第 {normalizedUnrelatedPage} / {unrelatedPageCount} 页，每页 {PAGE_SIZE} 条
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnrelatedPage((current) => Math.max(1, current - 1))}
                  disabled={normalizedUnrelatedPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnrelatedPage((current) => Math.min(unrelatedPageCount, current + 1))}
                  disabled={normalizedUnrelatedPage >= unrelatedPageCount}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="没有未关联对象" description="当前副池中没有可关联到主对象的剩余资源。" />
        )}
      </section>
    </div>
  );
}
