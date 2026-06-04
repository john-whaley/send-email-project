"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CopyPlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ResourceField } from "@/components/resources/resource-manager";

type FieldType = ResourceField["fieldType"];

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: "TEXT", label: "文本" },
  { value: "PASSWORD", label: "密码" },
  { value: "NUMBER", label: "数字" },
  { value: "BOOLEAN", label: "布尔" },
  { value: "DATE", label: "日期" },
  { value: "URL", label: "URL" },
  { value: "EMAIL", label: "邮箱" },
  { value: "PHONE", label: "手机号" },
  { value: "JSON", label: "JSON" }
];

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 100;

function normalizePageSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

type AdminPool = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  fields: ResourceField[];
  _count: {
    items: number;
  };
};

type EditableField = {
  key: string;
  id?: number;
  fieldName: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  unique: boolean;
};

type PoolForm = {
  id?: number;
  name: string;
  slug: string;
  description: string;
  fields: EditableField[];
};

const defaultField = (): EditableField => ({
  key: crypto.randomUUID(),
  fieldName: "name",
  label: "名称",
  fieldType: "TEXT",
  required: true,
  unique: false
});

const emptyForm = (): PoolForm => ({
  name: "",
  slug: "",
  description: "",
  fields: [defaultField()]
});

function toEditableForm(pool: AdminPool): PoolForm {
  return {
    id: pool.id,
    name: pool.name,
    slug: pool.slug,
    description: pool.description ?? "",
    fields: pool.fields.map((field) => ({
      key: String(field.id),
      id: field.id,
      fieldName: field.fieldName,
      label: field.label ?? field.fieldName,
      fieldType: field.fieldType,
      required: field.required,
      unique: field.unique
    }))
  };
}

export function PoolAdmin({ initialPools }: { initialPools: AdminPool[] }) {
  const router = useRouter();
  const [pools, setPools] = useState(initialPools);
  const [form, setForm] = useState<PoolForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [copySourcePoolId, setCopySourcePoolId] = useState<number | null>(null);
  const [copyItemsWithPool, setCopyItemsWithPool] = useState(false);

  const editingPool = useMemo(() => pools.find((pool) => pool.id === form.id), [pools, form.id]);
  const copySourcePool = useMemo(
    () => pools.find((pool) => pool.id === copySourcePoolId) ?? null,
    [copySourcePoolId, pools]
  );
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

  function startCreate() {
    setForm(emptyForm());
    setCopySourcePoolId(null);
    setCopyItemsWithPool(false);
    setMessage("");
  }

  function startEdit(pool: AdminPool) {
    setForm(toEditableForm(pool));
    setCopySourcePoolId(null);
    setCopyItemsWithPool(false);
    setMessage("");
  }

  function duplicatePool(pool: AdminPool) {
    setForm({
      ...toEditableForm(pool),
      id: undefined,
      name: `${pool.name}副本`,
      slug: ""
    });
    setCopySourcePoolId(pool.id);
    setCopyItemsWithPool(false);
    setMessage("");
  }

  function updateField(key: string, patch: Partial<EditableField>) {
    setForm((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.key === key ? { ...field, ...patch } : field))
    }));
  }

  function addField() {
    setForm((current) => ({
      ...current,
      fields: [
        ...current.fields,
        {
          key: crypto.randomUUID(),
          fieldName: "",
          label: "",
          fieldType: "TEXT",
          required: false,
          unique: false
        }
      ]
    }));
  }

  function removeField(key: string) {
    setForm((current) => ({
      ...current,
      fields: current.fields.length === 1 ? current.fields : current.fields.filter((field) => field.key !== key)
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description,
      fields: form.fields.map((field, index) => ({
        id: field.id,
        fieldName: field.fieldName,
        label: field.label,
        fieldType: field.fieldType,
        required: field.required,
        unique: field.unique,
        sortOrder: index
      })),
      copyItemsFromPoolId: !form.id && copyItemsWithPool && copySourcePoolId ? copySourcePoolId : undefined
    };

    const response = await fetch(form.id ? `/api/pools/${form.id}` : "/api/pools", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "保存失败");
      setLoading(false);
      return;
    }

    const savedPool = result.pool as AdminPool;
    setPools((current) =>
      form.id ? current.map((pool) => (pool.id === savedPool.id ? savedPool : pool)) : [...current, savedPool]
    );
    if (!form.id) {
      setPage(Math.max(1, Math.ceil((pools.length + 1) / pageSize)));
    }
    setForm(toEditableForm(savedPool));
    setCopySourcePoolId(null);
    setCopyItemsWithPool(false);
    setLoading(false);
    router.refresh();
  }

  async function handleDelete(pool: AdminPool) {
    if (!window.confirm(`确认删除 ${pool.name}？该池子的资源和关联关系也会删除。`)) {
      return;
    }

    const response = await fetch(`/api/pools/${pool.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "删除失败");
      return;
    }

    setPools((current) => current.filter((candidate) => candidate.id !== pool.id));
    if (form.id === pool.id) {
      startCreate();
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">已有池子</h2>
            <p className="text-sm text-muted-foreground">{pools.length} 个池子</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="pool-page-size" className="whitespace-nowrap text-muted-foreground">
                每页
              </Label>
              <Input
                id="pool-page-size"
                type="number"
                min={1}
                max={MAX_PAGE_SIZE}
                value={pageSize}
                onChange={(event) => setPageSize(normalizePageSize(Number(event.target.value)))}
                className="h-9 w-20"
              />
              <span className="whitespace-nowrap text-muted-foreground">条</span>
            </div>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              新建池子
            </Button>
          </div>
        </div>

        {pools.length ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {pagedPools.map((pool) => (
                <Card key={pool.id} className={editingPool?.id === pool.id ? "ring-2 ring-ring" : undefined}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span>{pool.name}</span>
                      <Badge variant="muted">{pool._count.items} 条资源</Badge>
                    </CardTitle>
                    <CardDescription>{pool.description || "未填写描述"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {pool.fields.map((field) => (
                        <Badge key={field.id} variant={field.required ? "default" : "outline"}>
                          {field.label || field.fieldName}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => duplicatePool(pool)}>
                        <CopyPlus className="h-4 w-4" aria-hidden="true" />
                        复制
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startEdit(pool)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        编辑
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(pool)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                共 {pools.length} 个，第 {normalizedPage} / {pageCount} 页，每页 {pageSize} 条
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
          <EmptyState title="还没有池子" description="从右侧表单创建第一个动态资源池。" />
        )}
      </section>

      <aside>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{form.id ? "编辑池子" : "新建池子"}</CardTitle>
                <CardDescription>字段名用于 JSON 存储，建议使用英文、数字和下划线。</CardDescription>
              </div>
              {!form.id && copySourcePool ? (
                <Button
                  type="button"
                  variant={copyItemsWithPool ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCopyItemsWithPool((current) => !current)}
                  title="只复制资源数据，不复制任何关联关系"
                >
                  <CopyPlus className="h-4 w-4" aria-hidden="true" />
                  {copyItemsWithPool ? "已选择复制资源" : "复制资源数据"}
                </Button>
              ) : null}
            </div>
            {!form.id && copySourcePool ? (
              <p className="text-sm text-muted-foreground">
                来源：{copySourcePool.name}。开启后会复制 {copySourcePool._count.items} 条资源数据，不复制原有关联关系。
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pool-name">池子名称</Label>
                  <Input id="pool-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pool-slug">Slug</Label>
                  <Input id="pool-slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="自动生成" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pool-description">描述</Label>
                <Textarea id="pool-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>字段</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addField}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    添加字段
                  </Button>
                </div>
                {form.fields.map((field, index) => (
                  <div key={field.key} className="rounded-lg border bg-background p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium">字段 {index + 1}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeField(field.key)} title="移除字段" aria-label="移除字段">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>字段名</Label>
                        <Input value={field.fieldName} onChange={(event) => updateField(field.key, { fieldName: event.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>显示名</Label>
                        <Input value={field.label} onChange={(event) => updateField(field.key, { label: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>类型</Label>
                        <Select value={field.fieldType} onChange={(event) => updateField(field.key, { fieldType: event.target.value as FieldType })}>
                          {FIELD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-6">
                        <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                          <input type="checkbox" checked={field.required} onChange={(event) => updateField(field.key, { required: event.target.checked })} />
                          必填
                        </label>
                        <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                          <input type="checkbox" checked={field.unique} onChange={(event) => updateField(field.key, { unique: event.target.checked })} />
                          唯一
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {message ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p> : null}

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {loading ? "保存中..." : "保存"}
                </Button>
                <Button type="button" variant="outline" onClick={startCreate}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  清空
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
