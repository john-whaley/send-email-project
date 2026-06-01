import { AdminResources } from "@/components/admin/admin-resources";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminResourcesPage() {
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
      <PageHeader title="资源管理" description="按池子录入资源，也可以上传 CSV 或 Excel 批量导入。" />
      <AdminResources
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
          itemCount: pool._count.items
        }))}
      />
    </>
  );
}
