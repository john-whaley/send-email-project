"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { ResourceManager, type ResourceItem, type ResourcePool } from "@/components/resources/resource-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type AdminPool = ResourcePool & {
  itemCount: number;
};

export function AdminResources({ pools }: { pools: AdminPool[] }) {
  const router = useRouter();
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(pools[0]?.id ?? null);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  const selectedPool = useMemo(() => pools.find((pool) => pool.id === selectedPoolId) ?? null, [pools, selectedPoolId]);

  useEffect(() => {
    if (!selectedPoolId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/pools/${selectedPoolId}/items`)
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) {
          setItems(result.items ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPoolId, version]);

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPoolId || !file) {
      setMessage("请选择池子和文件");
      return;
    }

    setMessage("");
    const formData = new FormData();
    formData.append("poolId", String(selectedPoolId));
    formData.append("file", file);

    const response = await fetch("/api/import", {
      method: "POST",
      body: formData
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "导入失败");
      return;
    }

    setMessage(`已导入 ${result.imported} 条，失败 ${result.failed} 条`);
    setFile(null);
    setVersion((current) => current + 1);
    router.refresh();
  }

  if (!pools.length) {
    return <EmptyState title="还没有池子" description="请先在池子管理中创建资源池。" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-4">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="resource-pool-select">选择池子</Label>
            <Select id="resource-pool-select" value={String(selectedPoolId ?? "")} onChange={(event) => setSelectedPoolId(Number(event.target.value))}>
              {pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{loading ? "资源加载中..." : `${items.length} 条资源`}</p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {selectedPool?.fields.map((field) => (
              <Badge key={field.id} variant={field.required ? "default" : "outline"}>
                {field.label || field.fieldName}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {selectedPool ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <ResourceManager key={selectedPool.id} pool={selectedPool} initialItems={items} canManage />

          <aside>
            <Card>
              <CardHeader>
                <CardTitle>批量导入</CardTitle>
                <CardDescription>首行需要与字段名一致，支持 CSV、XLS 和 XLSX。</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleImport} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resource-file">文件</Label>
                    <input
                      id="resource-file"
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  {message ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
                  <Button type="submit" disabled={!file}>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    导入
                  </Button>
                </form>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
