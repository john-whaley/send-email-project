import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getItemDisplayName } from "@/lib/resource";
import { toInt } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ poolId: string; itemId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return fail("未登录", 401);
  }

  const { poolId, itemId } = await context.params;
  const parsedPoolId = toInt(poolId);
  const parsedItemId = toInt(itemId);

  if (!parsedPoolId || !parsedItemId) {
    return fail("无效资源 ID");
  }

  const relations = await prisma.relation.findMany({
    where: {
      note: { not: null },
      OR: [
        { sourcePoolId: parsedPoolId, sourceItemId: parsedItemId },
        { targetPoolId: parsedPoolId, targetItemId: parsedItemId }
      ]
    },
    include: {
      sourcePool: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
      targetPool: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
      sourceItem: true,
      targetItem: true
    },
    orderBy: { createdAt: "desc" }
  });

  const notes = relations
    .filter((relation) => relation.note?.trim())
    .map((relation) => {
      const isSource = relation.sourcePoolId === parsedPoolId && relation.sourceItemId === parsedItemId;
      const currentPool = isSource ? relation.sourcePool : relation.targetPool;
      const currentItem = isSource ? relation.sourceItem : relation.targetItem;
      const relatedPool = isSource ? relation.targetPool : relation.sourcePool;
      const relatedItem = isSource ? relation.targetItem : relation.sourceItem;

      return {
        relationId: relation.id,
        note: relation.note,
        createdAt: relation.createdAt,
        current: {
          poolId: currentPool.id,
          poolName: currentPool.name,
          itemId: currentItem.id,
          displayName: getItemDisplayName(currentItem, currentPool.fields)
        },
        related: {
          poolId: relatedPool.id,
          poolName: relatedPool.name,
          itemId: relatedItem.id,
          displayName: getItemDisplayName(relatedItem, relatedPool.fields)
        },
        exploreUrl: `/relations?sourcePoolId=${relatedPool.id}&sourceItemId=${relatedItem.id}&targetPoolId=${currentPool.id}`
      };
    });

  return ok({ notes });
}
