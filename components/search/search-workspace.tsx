"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Database, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";

type SearchResult = {
  pools: Array<{
    id: number;
    name: string;
    slug: string;
    description: string | null;
  }>;
  items: Array<{
    id: number;
    poolId: number;
    poolName: string;
    displayName: string;
    data: Record<string, unknown>;
    related: Array<{
      relationId: number;
      poolId: number;
      poolName: string;
      itemId: number;
      displayName: string;
      data: Record<string, unknown>;
    }>;
  }>;
};

const emptyResult: SearchResult = {
  pools: [],
  items: []
};

export function SearchWorkspace({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult>(emptyResult);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setResult(emptyResult);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((payload) => {
          setResult({
            pools: payload.pools ?? [],
            items: payload.items ?? []
          });
          setLoading(false);
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            setLoading(false);
          }
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const hasResult = result.pools.length > 0 || result.items.length > 0;

  return (
    <div className="space-y-6">
      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入关键词" className="pl-8" autoFocus />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{loading ? "搜索中..." : `池子 ${result.pools.length} 个，资源 ${result.items.length} 条`}</span>
      </div>

      {hasResult ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="space-y-3">
            <h2 className="text-base font-semibold">匹配池子</h2>
            {result.pools.length ? (
              result.pools.map((pool) => (
                <Card key={pool.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-4 w-4" aria-hidden="true" />
                      {pool.name}
                    </CardTitle>
                    <CardDescription>{pool.description || "未填写描述"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/pools/${pool.id}`}>
                        打开
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <EmptyState title="没有匹配池子" />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">匹配资源</h2>
            {result.items.map((item) => (
              <Card key={`${item.poolId}-${item.id}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>{item.displayName}</CardTitle>
                      <CardDescription>{item.poolName}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/pools/${item.poolId}`}>打开池子</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <pre className="max-h-36 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(item.data, null, 2)}
                  </pre>
                  {item.related.length ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">关联资源</p>
                      <div className="flex flex-wrap gap-2">
                        {item.related.map((related) => (
                          <Badge key={related.relationId} variant="secondary">
                            {related.poolName}: {related.displayName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </section>
        </div>
      ) : (
        <EmptyState title={query.trim() ? "没有搜索结果" : "输入关键词开始搜索"} />
      )}
    </div>
  );
}
