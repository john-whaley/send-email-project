"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowUpDown, ChevronLeft, ChevronRight, FileText, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { asRecord, maskSensitiveValue } from "@/lib/resource";
import { formatDateTime } from "@/lib/utils";

type FieldType = "TEXT" | "PASSWORD" | "NUMBER" | "BOOLEAN" | "DATE" | "URL" | "EMAIL" | "PHONE" | "JSON";

export type ResourceField = {
  id: number;
  fieldName: string;
  label: string | null;
  fieldType: FieldType;
  required: boolean;
  unique: boolean;
  sortOrder: number;
};

export type ResourcePool = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  fields: ResourceField[];
};

export type ResourceItem = {
  id: number;
  poolId: number;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  noteCount?: number;
};

type ResourceManagerProps = {
  pool: ResourcePool;
  initialItems: ResourceItem[];
  canManage: boolean;
};

type ResourceRelationNote = {
  relationId: number;
  note: string;
  createdAt: string;
  current: { poolId: number; poolName: string; itemId: number; displayName: string };
  related: { poolId: number; poolName: string; itemId: number; displayName: string };
  exploreUrl: string;
};

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 100;

type SortMode = "ID_ASC" | "UPDATED_ASC" | "UPDATED_DESC";

function createEmptyData(fields: ResourceField[]) {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field.fieldName] = field.fieldType === "BOOLEAN" ? false : "";
    return acc;
  }, {});
}

function prepareDataForEdit(fields: ResourceField[], item?: ResourceItem) {
  const data = createEmptyData(fields);

  if (!item) {
    return data;
  }

  const itemData = asRecord(item.data);

  for (const field of fields) {
    const value = itemData[field.fieldName];
    data[field.fieldName] =
      field.fieldType === "JSON" && value && typeof value === "object" ? JSON.stringify(value, null, 2) : value ?? "";
  }

  return data;
}

function inputTypeFor(fieldType: FieldType) {
  if (fieldType === "PASSWORD") return "password";
  if (fieldType === "NUMBER") return "number";
  if (fieldType === "DATE") return "date";
  if (fieldType === "URL") return "url";
  if (fieldType === "EMAIL") return "email";
  if (fieldType === "PHONE") return "tel";
  return "text";
}

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

export function ResourceManager({ pool, initialItems, canManage }: ResourceManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState<ResourceItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortMode, setSortMode] = useState<SortMode>("ID_ASC");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingItem, setEditingItem] = useState<ResourceItem | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>(createEmptyData(pool.fields));
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [noteDialogItem, setNoteDialogItem] = useState<ResourceItem | null>(null);
  const [relationNotes, setRelationNotes] = useState<ResourceRelationNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteDialogMessage, setNoteDialogMessage] = useState("");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchedItems = query
      ? items.filter((item) => JSON.stringify(item.data).toLowerCase().includes(query))
      : items;

    return [...matchedItems].sort((left, right) => {
      if (sortMode === "UPDATED_ASC") {
        return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
      }

      if (sortMode === "UPDATED_DESC") {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }

      return left.id - right.id;
    });
  }, [items, search, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const normalizedPage = Math.min(page, pageCount);
  const pagedItems = filteredItems.slice((normalizedPage - 1) * pageSize, normalizedPage * pageSize);
  const selectedCount = selectedIds.size;
  const pageSelected = pagedItems.length > 0 && pagedItems.every((item) => selectedIds.has(item.id));

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, pool.id]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, pool.id]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    setSelectedIds((current) => {
      const existingIds = new Set(items.map((item) => item.id));
      const next = new Set([...current].filter((id) => existingIds.has(id)));

      return next.size === current.size ? current : next;
    });
  }, [items]);

  function startCreate() {
    setEditingItem(null);
    setFormData(createEmptyData(pool.fields));
    setShowForm(true);
    setMessage("");
  }

  function startEdit(item: ResourceItem) {
    setEditingItem(item);
    setFormData(prepareDataForEdit(pool.fields, item));
    setShowForm(true);
    setMessage("");
  }

  function cancelEdit() {
    setEditingItem(null);
    setFormData(createEmptyData(pool.fields));
    setShowForm(false);
    setMessage("");
  }

  function handlePageSizeChange(value: string) {
    setPageSize(normalizePageSize(Number(value)));
  }

  function toggleUpdatedAtSort() {
    setSortMode((current) => {
      if (current === "UPDATED_DESC") {
        return "UPDATED_ASC";
      }

      if (current === "UPDATED_ASC") {
        return "ID_ASC";
      }

      return "UPDATED_DESC";
    });
  }

  function toggleSelected(itemId: number, checked: boolean) {
    setSelectedIds((current) => {
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
    setSelectedIds((current) => {
      const next = new Set(current);

      for (const item of pagedItems) {
        if (checked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      }

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const url = editingItem ? `/api/pools/${pool.id}/items/${editingItem.id}` : `/api/pools/${pool.id}/items`;
    const response = await fetch(url, {
      method: editingItem ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: formData })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "保存失败");
      setLoading(false);
      return;
    }

    const savedItem = result.item as ResourceItem;
    setItems((current) =>
      editingItem
        ? current.map((item) => (item.id === savedItem.id ? { ...savedItem, noteCount: item.noteCount ?? 0 } : item))
        : [...current, { ...savedItem, noteCount: savedItem.noteCount ?? 0 }]
    );
    setLoading(false);
    cancelEdit();
    router.refresh();
  }

  async function handleDelete(item: ResourceItem) {
    if (!window.confirm(`确认删除 ${item.displayName}？`)) {
      return;
    }

    const response = await fetch(`/api/pools/${pool.id}/items/${item.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "删除失败");
      return;
    }

    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    router.refresh();
  }

  async function handleBatchDelete() {
    if (!selectedCount) {
      setMessage("请先勾选要删除的资源");
      return;
    }

    if (!window.confirm(`确认删除选中的 ${selectedCount} 条资源？相关关联关系也会一并删除。`)) {
      return;
    }

    const ids = [...selectedIds];
    const response = await fetch(`/api/pools/${pool.id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "批量删除失败");
      return;
    }

    const deletedIds = new Set(ids);
    setItems((current) => current.filter((candidate) => !deletedIds.has(candidate.id)));
    setSelectedIds(new Set());
    setMessage(`已删除 ${result.deleted ?? selectedCount} 条资源`);
    router.refresh();
  }

  async function openNoteDialog(item: ResourceItem) {
    setNoteDialogItem(item);
    setRelationNotes([]);
    setNoteDialogMessage("");
    setLoadingNotes(true);

    const response = await fetch(`/api/pools/${pool.id}/items/${item.id}/notes`);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNoteDialogMessage(result.error ?? "读取注释失败");
      setLoadingNotes(false);
      return;
    }

    setRelationNotes(result.notes ?? []);
    setLoadingNotes(false);
  }

  function closeNoteDialog() {
    setNoteDialogItem(null);
    setRelationNotes([]);
    setLoadingNotes(false);
    setNoteDialogMessage("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`搜索${pool.name}`} className="pl-8" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Label htmlFor={`page-size-${pool.id}`} className="whitespace-nowrap text-muted-foreground">
                每页
              </Label>
              <Input
                id={`page-size-${pool.id}`}
                type="number"
                min={1}
                max={MAX_PAGE_SIZE}
                value={pageSize}
                onChange={(event) => handlePageSizeChange(event.target.value)}
                className="h-9 w-20"
                aria-label="每页条数"
              />
              <span className="whitespace-nowrap">条</span>
            </div>
            {canManage ? (
              <>
                <Button variant="outline" onClick={handleBatchDelete} disabled={!selectedCount}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  批量删除{selectedCount ? ` ${selectedCount}` : ""}
                </Button>
                <Button onClick={startCreate}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  新增
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {message ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p> : null}

        {filteredItems.length ? (
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
                        aria-label="勾选当前页资源"
                      />
                    </TableHead>
                  ) : null}
                  {pool.fields.map((field) => (
                    <TableHead key={field.id}>{field.label || field.fieldName}</TableHead>
                  ))}
                  <TableHead className="w-24 text-right">注释总数</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleUpdatedAtSort}
                      className="-ml-3 h-8 px-2"
                      title="点击按更新时间降序、升序、ID 顺序切换"
                    >
                      更新时间
                      {sortMode === "UPDATED_DESC" ? " ↓" : sortMode === "UPDATED_ASC" ? " ↑" : ""}
                      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TableHead>
                  <TableHead className={canManage ? "w-32 text-right" : "w-16 text-right"}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map((item) => (
                  <TableRow key={item.id}>
                    {canManage ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={(event) => toggleSelected(item.id, event.target.checked)}
                          aria-label={`勾选 ${item.displayName}`}
                        />
                      </TableCell>
                    ) : null}
                    {pool.fields.map((field) => (
                      <TableCell key={field.id} className="max-w-64 truncate">
                        {renderValue(field, item.data)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openNoteDialog(item)}
                        title={`查看 ${item.displayName} 的关联注释`}
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        {item.noteCount ?? 0}
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(item.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="关联查询" aria-label={`关联查询 ${item.displayName}`} asChild>
                          <Link href={`/relations?sourcePoolId=${pool.id}&sourceItemId=${item.id}`}>
                            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </Button>
                        {canManage ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(item)} title="编辑" aria-label="编辑">
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title="删除" aria-label="删除">
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                共 {filteredItems.length} 条，第 {normalizedPage} / {pageCount} 页，每页 {pageSize} 条
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
          </div>
        ) : (
          <EmptyState title="没有资源" description={search ? "换一个关键词试试。" : "管理员可以从右侧开始录入。"} />
        )}
      </section>

      {canManage ? (
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{showForm ? (editingItem ? "编辑资源" : "新增资源") : "资源录入"}</CardTitle>
              <CardDescription>{pool.name} 会按字段配置自动生成表单。</CardDescription>
            </CardHeader>
            <CardContent>
              {showForm ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {pool.fields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={`field-${field.fieldName}`}>
                        {field.label || field.fieldName}
                        {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                      </Label>
                      {field.fieldType === "BOOLEAN" ? (
                        <Select
                          id={`field-${field.fieldName}`}
                          value={String(Boolean(formData[field.fieldName]))}
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              [field.fieldName]: event.target.value === "true"
                            }))
                          }
                        >
                          <option value="false">否</option>
                          <option value="true">是</option>
                        </Select>
                      ) : field.fieldType === "JSON" ? (
                        <Textarea
                          id={`field-${field.fieldName}`}
                          value={String(formData[field.fieldName] ?? "")}
                          onChange={(event) =>
                            setFormData((current) => ({ ...current, [field.fieldName]: event.target.value }))
                          }
                          required={field.required}
                        />
                      ) : (
                        <Input
                          id={`field-${field.fieldName}`}
                          type={inputTypeFor(field.fieldType)}
                          value={String(formData[field.fieldName] ?? "")}
                          onChange={(event) =>
                            setFormData((current) => ({ ...current, [field.fieldName]: event.target.value }))
                          }
                          required={field.required}
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      <Save className="h-4 w-4" aria-hidden="true" />
                      {loading ? "保存中..." : "保存"}
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      取消
                    </Button>
                  </div>
                </form>
              ) : (
                <Button onClick={startCreate} className="w-full">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  新增资源
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      ) : null}

      {noteDialogItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-lg border bg-card p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">关联注释</h3>
                <p className="text-sm text-muted-foreground">
                  {pool.name}-{noteDialogItem.displayName}，共 {relationNotes.length} 条注释
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeNoteDialog} title="关闭" aria-label="关闭注释列表">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {noteDialogMessage ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {noteDialogMessage}
              </p>
            ) : null}

            <div className="mt-4 max-h-[60vh] overflow-auto rounded-lg border">
              {loadingNotes ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">读取中...</p>
              ) : relationNotes.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-56">关联对象</TableHead>
                      <TableHead>注释</TableHead>
                      <TableHead className="w-36">建立时间</TableHead>
                      <TableHead className="w-20 text-right">查询</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationNotes.map((relationNote) => (
                      <TableRow key={relationNote.relationId}>
                        <TableCell className="max-w-56">
                          <p className="truncate text-sm font-medium" title={relationNote.related.displayName}>
                            {relationNote.related.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">{relationNote.related.poolName}</p>
                        </TableCell>
                        <TableCell className="max-w-md truncate" title={relationNote.note}>
                          {relationNote.note}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(relationNote.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" title="关联查询" aria-label="关联查询" asChild>
                            <Link href={relationNote.exploreUrl}>
                              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">暂无关联注释</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
