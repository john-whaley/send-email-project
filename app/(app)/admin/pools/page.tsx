import { PoolAdmin } from "@/components/admin/pool-admin";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminPoolsPage() {
  await requireAdmin();

  const pools = await prisma.pool.findMany({
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  return (
    <>
      <PageHeader title="池子管理" description="创建资源池、维护字段结构，导航菜单会自动同步新的池子类型。" />
      <PoolAdmin
        initialPools={pools.map((pool) => ({
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
          _count: pool._count
        }))}
      />
    </>
  );
}
