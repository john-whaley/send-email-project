import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getItemDisplayName } from "@/lib/resource";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return fail("未登录", 401);
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (!q) {
    return ok({ query: "", pools: [], items: [] });
  }

  const pools = await prisma.pool.findMany({
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      items: {
        take: 1000,
        orderBy: { updatedAt: "desc" }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const matchedPools = pools
    .filter((pool) => `${pool.name} ${pool.description ?? ""}`.toLowerCase().includes(q))
    .map((pool) => ({
      id: pool.id,
      name: pool.name,
      slug: pool.slug,
      description: pool.description
    }));

  const matchedItems = pools.flatMap((pool) =>
    pool.items
      .filter((item) => JSON.stringify(item.data).toLowerCase().includes(q))
      .map((item) => ({
        id: item.id,
        poolId: pool.id,
        poolName: pool.name,
        data: item.data,
        displayName: getItemDisplayName(item, pool.fields),
        updatedAt: item.updatedAt
      }))
  );

  const itemIds = matchedItems.map((item) => item.id);
  const relations = itemIds.length
    ? await prisma.relation.findMany({
        where: {
          OR: [{ sourceItemId: { in: itemIds } }, { targetItemId: { in: itemIds } }]
        },
        include: {
          sourcePool: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
          targetPool: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
          sourceItem: true,
          targetItem: true
        },
        take: 200,
        orderBy: { createdAt: "desc" }
      })
    : [];

  const items = matchedItems.map((item) => {
    const related = relations
      .filter((relation) => relation.sourceItemId === item.id || relation.targetItemId === item.id)
      .map((relation) => {
        const isSource = relation.sourceItemId === item.id;
        const relatedItem = isSource ? relation.targetItem : relation.sourceItem;
        const relatedPool = isSource ? relation.targetPool : relation.sourcePool;

        return {
          relationId: relation.id,
          poolId: relatedPool.id,
          poolName: relatedPool.name,
          itemId: relatedItem.id,
          displayName: getItemDisplayName(relatedItem, relatedPool.fields),
          data: relatedItem.data
        };
      });

    return { ...item, related };
  });

  return ok({ query: q, pools: matchedPools, items });
}
