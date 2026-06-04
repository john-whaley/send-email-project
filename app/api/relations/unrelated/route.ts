import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getItemDisplayName } from "@/lib/resource";
import { toInt } from "@/lib/utils";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return fail("未登录", 401);
  }

  const url = new URL(request.url);
  const sourcePoolId = toInt(url.searchParams.get("sourcePoolId"));
  const sourceItemId = toInt(url.searchParams.get("sourceItemId"));
  const targetPoolId = toInt(url.searchParams.get("targetPoolId"));

  if (!sourcePoolId || !sourceItemId || !targetPoolId) {
    return fail("缺少必要查询参数");
  }

  const [sourceItem, targetPool, relations] = await Promise.all([
    prisma.poolItem.findFirst({
      where: {
        id: sourceItemId,
        poolId: sourcePoolId
      }
    }),
    prisma.pool.findUnique({
      where: { id: targetPoolId },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        items: { orderBy: { id: "asc" } }
      }
    }),
    prisma.relation.findMany({
      where: {
        OR: [
          {
            sourcePoolId,
            sourceItemId,
            targetPoolId
          },
          {
            targetPoolId: sourcePoolId,
            targetItemId: sourceItemId,
            sourcePoolId: targetPoolId
          }
        ]
      },
      select: {
        sourcePoolId: true,
        sourceItemId: true,
        targetPoolId: true,
        targetItemId: true
      }
    })
  ]);

  if (!sourceItem) {
    return fail("主对象不存在", 404);
  }

  if (!targetPool) {
    return fail("副池不存在", 404);
  }

  const relatedTargetIds = new Set(
    relations.map((relation) => {
      const isForward = relation.sourcePoolId === sourcePoolId && relation.sourceItemId === sourceItemId;
      return isForward ? relation.targetItemId : relation.sourceItemId;
    })
  );

  const items = targetPool.items
    .filter((item) => {
      const isSourceItemInSamePool = sourcePoolId === targetPoolId && item.id === sourceItemId;
      return !isSourceItemInSamePool && !relatedTargetIds.has(item.id);
    })
    .map((item) => ({
      id: item.id,
      poolId: item.poolId,
      data: item.data,
      displayName: getItemDisplayName(item, targetPool.fields),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

  return ok({
    pool: {
      id: targetPool.id,
      name: targetPool.name,
      fields: targetPool.fields
    },
    total: items.length,
    items
  });
}
