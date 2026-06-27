import { notFound } from "next/navigation";
import { ResourceManager } from "@/components/resources/resource-manager";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getItemDisplayName } from "@/lib/resource";
import { toInt } from "@/lib/utils";

type PoolPageProps = {
  params: Promise<{ poolId: string }>;
};

export default async function PoolPage({ params }: PoolPageProps) {
  const user = await getCurrentUser();
  const { poolId } = await params;
  const id = toInt(poolId);

  if (!id) {
    notFound();
  }

  const pool = await prisma.pool.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { id: "asc" } }
    }
  });

  if (!pool) {
    notFound();
  }

  const notedRelations = await prisma.relation.findMany({
    where: {
      note: { not: null },
      OR: [{ sourcePoolId: pool.id }, { targetPoolId: pool.id }]
    },
    select: { sourceItemId: true, targetItemId: true, sourcePoolId: true, targetPoolId: true, note: true }
  });
  const noteCounts = new Map<number, number>();

  for (const relation of notedRelations) {
    if (!relation.note?.trim()) {
      continue;
    }

    if (relation.sourcePoolId === pool.id) {
      noteCounts.set(relation.sourceItemId, (noteCounts.get(relation.sourceItemId) ?? 0) + 1);
    }

    if (relation.targetPoolId === pool.id) {
      noteCounts.set(relation.targetItemId, (noteCounts.get(relation.targetItemId) ?? 0) + 1);
    }
  }

  const serializedPool = {
    id: pool.id,
    name: pool.name,
    slug: pool.slug,
    description: pool.description,
    fields: pool.fields.map((field) => ({
      id: field.id,
      fieldName: field.fieldName,
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
      unique: field.unique,
      sortOrder: field.sortOrder
    }))
  };

  const items = pool.items.map((item) => ({
    id: item.id,
    poolId: item.poolId,
    data: item.data as Record<string, unknown>,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    displayName: getItemDisplayName(item, pool.fields),
    noteCount: noteCounts.get(item.id) ?? 0
  }));

  return (
    <>
      <PageHeader
        title={pool.name}
        description={pool.description || "动态字段资源池"}
        actions={<Badge variant="secondary">{pool.fields.length} 个字段</Badge>}
      />
      <ResourceManager pool={serializedPool} initialItems={items} canManage={user?.role === "ADMIN"} />
    </>
  );
}
