"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Link2, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
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

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 100;

function normalizePageSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

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
  const [selectedRelatedIds, setSelectedRelatedIds] = useState<Set<number>>(new Set());
  const [selectedUnrelatedIds, setSelectedUnrelatedIds] = useState<Set<number>>(new Set());
  const [relatedPage, setRelatedPage] = useState(1);
  const [relatedPageSize, setRelatedPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [unrelatedPage, setUnrelatedPage] = useState(1);
  const [unrelatedPageSize, setUnrelatedPageSize] = useState(DEFAULT_PAGE_SIZE);
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
  const poolOptions = useMemo(
    () =>
      pools.map((pool) => ({
        value: String(pool.id),
        label: pool.name,
        searchText: `${pool.slug} ${pool.description ?? ""}`
      })),
    [pools]
  );
  const sourceItemOptions = useMemo(
    () =>
      (sourcePool?.items ?? []).map((item) => ({
        value: String(item.id),
        label: item.displayName,
        searchText: JSON.stringify(item.data)
      })),
    [sourcePool]
  );

  const filteredRelatedItems = useMemo(
    () => relatedItems.filter((item) => itemMatchesQuery(item, relatedQuery)),
    [relatedItems, relatedQuery]
  );

  const filteredUnrelatedItems = useMemo(
    () => unrelatedItems.filter((item) => itemMatchesQuery(item, unrelatedQuery)),
    [unrelatedItems, unrelatedQuery]
  );

  const relatedPageCount = Math.max(1, Math.ceil(filteredRelatedItems.length / relatedPageSize));
  const normalizedRelatedPage = Math.min(relatedPage, relatedPageCount);
  const pagedRelatedItems = filteredRelatedItems.slice(
    (normalizedRelatedPage - 1) * relatedPageSize,
    normalizedRelatedPage * relatedPageSize
  );
  const unrelatedPageCount = Math.max(1, Math.ceil(filteredUnrelatedItems.length / unrelatedPageSize));
  const normalizedUnrelatedPage = Math.min(unrelatedPage, unrelatedPageCount);
  const pagedUnrelatedItems = filteredUnrelatedItems.slice(
    (normalizedUnrelatedPage - 1) * unrelatedPageSize,
    normalizedUnrelatedPage * unrelatedPageSize
  );
  const selectedRelatedCount = selectedRelatedIds.size;
  const relatedPageSelected =
    pagedRelatedItems.length > 0 && pagedRelatedItems.every((item) => selectedRelatedIds.has(item.relationId));
  const selectedUnrelatedCount = selectedUnrelatedIds.size;
  const unrelatedPageSelected =
    pagedUnrelatedItems.length > 0 && pagedUnrelatedItems.every((item) => selectedUnrelatedIds.has(item.id));

  useEffect(() => {
    if (!sourcePool) {
      setSourceItemId(null);
      return;
    }

    setSourceItemId((currentItemId) => {
      if (currentItemId && sourcePool.items.some((item) => item.id === currentItemId)) {
        return currentItemId;
      }

      return sourcePool.items[0]?.id ?? null;
    });
  }, [sourcePoolId, sourcePool]);

  useEffect(() => {
    setRelatedPage(1);
    setSelectedRelatedIds(new Set());
  }, [sourcePoolId, sourceItemId, targetPoolId, relatedQuery, relatedPageSize]);

  useEffect(() => {
    setUnrelatedPage(1);
    setSelectedUnrelatedIds(new Set());
  }, [sourcePoolId, sourceItemId, targetPoolId, unrelatedQuery, unrelatedPageSize]);

  useEffect(() => {
    if (relatedPage > relatedPageCount) {
      setRelatedPage(relatedPageCount);
    }
  }, [relatedPage, relatedPageCount]);

  useEffect(() => {
    if (unrelatedPage > unrelatedPageCount) {
      setUnrelatedPage(unrelatedPageCount);
    }
  }, [unrelatedPage, unrelatedPageCount]);

  useEffect(() => {
    setSelectedRelatedIds((current) => {
      const existingIds = new Set(relatedItems.map((item) => item.relationId));
      const next = new Set([...current].filter((id) => existingIds.has(id)));

      return next.size === current.size ? current : next;
    });
  }, [relatedItems]);

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

  function toggleRelatedSelected(relationId: number, checked: boolean) {
    setSelectedRelatedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(relationId);
      } else {
        next.delete(relationId);
      }

      return next;
    });
  }

  function toggleRelatedPageSelected(checked: boolean) {
    setSelectedRelatedIds((current) => {
      const next = new Set(current);

      for (const item of pagedRelatedItems) {
        if (checked) {
          next.add(item.relationId);
        } else {
          next.delete(item.relationId);
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

  function moveRelatedItemsToUnrelated(items: RelatedItem[]) {
    setUnrelatedItems((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      const movedItems = items
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          id: item.id,
          poolId: item.poolId,
          data: item.data,
          displayName: item.displayName
        }));

      return [...movedItems, ...current];
    });
  }

  function handleReverseExplore(item: RelatedItem) {
    if (!sourcePoolId) {
      return;
    }

    const nextTargetPoolId = sourcePoolId;
    setSourcePoolId(item.poolId);
    setSourceItemId(item.id);
    setTargetPoolId(nextTargetPoolId);
    setRelatedQuery("");
    setUnrelatedQuery("");
    setMessage(`已切换为从 ${item.displayName} 反向查询`);
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
    setSelectedRelatedIds((current) => {
      const next = new Set(current);
      next.delete(item.relationId);
      return next;
    });
    moveRelatedItemsToUnrelated([item]);
    setMessage("关联已删除");
    router.refresh();
  }

  async function handleBatchDeleteRelations() {
    const selectedItems = relatedItems.filter((item) => selectedRelatedIds.has(item.relationId));

    if (!selectedItems.length) {
      setMessage("请先勾选要删除的关联");
      return;
    }

    if (!window.confirm(`确认删除选中的 ${selectedItems.length} 条关联？资源本身不会删除。`)) {
      return;
    }

    const relationIds = selectedItems.map((item) => item.relationId);
    const response = await fetch("/api/relations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: relationIds })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "批量删除关联失败");
      return;
    }

    const deletedIds = new Set(relationIds);
    setRelatedItems((current) => current.filter((item) => !deletedIds.has(item.relationId)));
    setSelectedRelatedIds(new Set());
    moveRelatedItemsToUnrelated(selectedItems);
    setMessage(`已删除 ${result.deleted ?? selectedItems.length} 条关联`);
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
            <SearchableSelect
              id="source-pool"
              value={String(sourcePoolId ?? "")}
              options={poolOptions}
              placeholder="搜索主池类型"
              onValueChange={(value) => setSourcePoolId(Number(value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-item">主对象</Label>
            <SearchableSelect
              id="source-item"
              value={String(sourceItemId ?? "")}
              options={sourceItemOptions}
              placeholder="搜索主对象"
              emptyText="当前池子没有匹配对象"
              disabled={!sourcePool}
              onValueChange={(value) => setSourceItemId(Number(value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-pool">副池类型</Label>
            <SearchableSelect
              id="target-pool"
              value={String(targetPoolId ?? "")}
              options={poolOptions}
              placeholder="搜索副池类型"
              onValueChange={(value) => setTargetPoolId(Number(value))}
            />
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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input value={relatedQuery} onChange={(event) => setRelatedQuery(event.target.value)} placeholder="搜索已关联对象" className="pl-8" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="related-page-size" className="whitespace-nowrap text-muted-foreground">
                每页
              </Label>
              <Input
                id="related-page-size"
                type="number"
                min={1}
                max={MAX_PAGE_SIZE}
                value={relatedPageSize}
                onChange={(event) => setRelatedPageSize(normalizePageSize(Number(event.target.value)))}
                className="h-9 w-20"
              />
              <span className="whitespace-nowrap text-muted-foreground">条</span>
            </div>
            {canManage ? (
              <Button variant="outline" onClick={handleBatchDeleteRelations} disabled={!selectedRelatedCount}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                批量删除{selectedRelatedCount ? ` ${selectedRelatedCount}` : ""}
              </Button>
            ) : null}
          </div>
        </div>

        {targetPool && pagedRelatedItems.length ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage ? (
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={relatedPageSelected}
                        onChange={(event) => toggleRelatedPageSelected(event.target.checked)}
                        aria-label="勾选当前页已关联对象"
                      />
                    </TableHead>
                  ) : null}
                  {targetPool.fields.map((field) => (
                    <TableHead key={field.id}>{field.label || field.fieldName}</TableHead>
                  ))}
                  <TableHead>建立时间</TableHead>
                  <TableHead className="w-24 text-right">反查</TableHead>
                  {canManage ? <TableHead className="w-16 text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRelatedItems.map((item) => (
                  <TableRow key={item.relationId}>
                    {canManage ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedRelatedIds.has(item.relationId)}
                          onChange={(event) => toggleRelatedSelected(item.relationId, event.target.checked)}
                          aria-label={`勾选 ${item.displayName} 的关联`}
                        />
                      </TableCell>
                    ) : null}
                    {targetPool.fields.map((field) => (
                      <TableCell key={field.id} className="max-w-64 truncate">
                        {renderValue(field, item.data)}
                      </TableCell>
                    ))}
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleReverseExplore(item)} title="将该对象设为主对象并交换主副池">
                        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                        反查
                      </Button>
                    </TableCell>
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

            <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                共 {filteredRelatedItems.length} 条，第 {normalizedRelatedPage} / {relatedPageCount} 页，每页 {relatedPageSize} 条
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRelatedPage((current) => Math.max(1, current - 1))}
                  disabled={normalizedRelatedPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRelatedPage((current) => Math.min(relatedPageCount, current + 1))}
                  disabled={normalizedRelatedPage >= relatedPageCount}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
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
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="unrelated-page-size" className="whitespace-nowrap text-muted-foreground">
                每页
              </Label>
              <Input
                id="unrelated-page-size"
                type="number"
                min={1}
                max={MAX_PAGE_SIZE}
                value={unrelatedPageSize}
                onChange={(event) => setUnrelatedPageSize(normalizePageSize(Number(event.target.value)))}
                className="h-9 w-20"
              />
              <span className="whitespace-nowrap text-muted-foreground">条</span>
            </div>
            {canManage ? (
              <Button onClick={handleBatchLink} disabled={!selectedUnrelatedCount}>
                <Link2 className="h-4 w-4" aria-hidden="true" />
                批量关联{selectedUnrelatedCount ? ` ${selectedUnrelatedCount}` : ""}
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
                        checked={unrelatedPageSelected}
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
                共 {filteredUnrelatedItems.length} 条，第 {normalizedUnrelatedPage} / {unrelatedPageCount} 页，每页 {unrelatedPageSize} 条
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
