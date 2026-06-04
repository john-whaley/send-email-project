"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
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
};

type ResourceManagerProps = {
  pool: ResourcePool;
  initialItems: ResourceItem[];
  canManage: boolean;
};

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 100;

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
  const [editingItem, setEditingItem] = useState<ResourceItem | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>(createEmptyData(pool.fields));
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => JSON.stringify(item.data).toLowerCase().includes(query));
  }, [items, search]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const normalizedPage = Math.min(page, pageCount);
  const pagedItems = filteredItems.slice((normalizedPage - 1) * pageSize, normalizedPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, pool.id]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

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
        ? current.map((item) => (item.id === savedItem.id ? savedItem : item))
        : [savedItem, ...current]
    );
    setPage(1);
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
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                新增
              </Button>
            ) : null}
          </div>
        </div>

        {message ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p> : null}

        {filteredItems.length ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {pool.fields.map((field) => (
                    <TableHead key={field.id}>{field.label || field.fieldName}</TableHead>
                  ))}
                  <TableHead>更新时间</TableHead>
                  {canManage ? <TableHead className="w-24 text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map((item) => (
                  <TableRow key={item.id}>
                    {pool.fields.map((field) => (
                      <TableCell key={field.id} className="max-w-64 truncate">
                        {renderValue(field, item.data)}
                      </TableCell>
                    ))}
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(item.updatedAt)}</TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(item)} title="编辑" aria-label="编辑">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title="删除" aria-label="删除">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                共 {filteredItems.length} 条，第 {normalizedPage} / {pageCount} 页
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
    </div>
  );
}
