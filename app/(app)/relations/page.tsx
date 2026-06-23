import { RelationExplorer } from "@/components/relations/relation-explorer";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getItemDisplayName } from "@/lib/resource";

type RelationsPageProps = {
  searchParams?: Promise<{
    sourcePoolId?: string;
    sourceItemId?: string;
    targetPoolId?: string;
  }>;
};

export default async function RelationsPage({ searchParams }: RelationsPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const pools = await prisma.pool.findMany({
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { id: "asc" } }
    },
    orderBy: { createdAt: "asc" }
  });

  return (
    <>
      <PageHeader
        title="关联查询"
        description="选择主池和主对象，再选择副池，系统会返回两者之间已建立的关联资源。"
      />
      <RelationExplorer
        canManage={user?.role === "ADMIN"}
        initialSourcePoolId={params?.sourcePoolId ? Number(params.sourcePoolId) : undefined}
        initialSourceItemId={params?.sourceItemId ? Number(params.sourceItemId) : undefined}
        initialTargetPoolId={params?.targetPoolId ? Number(params.targetPoolId) : undefined}
        pools={pools.map((pool) => ({
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
          })),
          items: pool.items.map((item) => ({
            id: item.id,
            poolId: item.poolId,
            data: item.data as Record<string, unknown>,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
            displayName: getItemDisplayName(item, pool.fields)
          }))
        }))}
      />
    </>
  );
}
