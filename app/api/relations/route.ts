import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, getErrorMessage, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createRelationSchema } from "@/lib/validators";
import { getItemDisplayName } from "@/lib/resource";
import { toInt } from "@/lib/utils";

function relationIncludes() {
  return {
    sourcePool: { include: { fields: { orderBy: { sortOrder: "asc" as const } } } },
    targetPool: { include: { fields: { orderBy: { sortOrder: "asc" as const } } } },
    sourceItem: true,
    targetItem: true,
    createdBy: { select: { id: true, username: true } }
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return fail("未登录", 401);
  }

  const url = new URL(request.url);
  const sourcePoolId = toInt(url.searchParams.get("sourcePoolId"));
  const sourceItemId = toInt(url.searchParams.get("sourceItemId"));
  const targetPoolId = toInt(url.searchParams.get("targetPoolId"));
  const q = url.searchParams.get("q")?.trim().toLowerCase();

  if (!sourcePoolId || !sourceItemId || !targetPoolId) {
    return ok({ relations: [], items: [] });
  }

  const relations = await prisma.relation.findMany({
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
    include: relationIncludes(),
    orderBy: { createdAt: "desc" }
  });

  const items = relations
    .map((relation) => {
      const isForward = relation.sourcePoolId === sourcePoolId && relation.sourceItemId === sourceItemId;
      const item = isForward ? relation.targetItem : relation.sourceItem;
      const pool = isForward ? relation.targetPool : relation.sourcePool;

      return {
        relationId: relation.id,
        id: item.id,
        poolId: pool.id,
        poolName: pool.name,
        data: item.data,
        displayName: getItemDisplayName(item, pool.fields),
        createdAt: relation.createdAt,
        note: relation.note
      };
    })
    .filter((item) => {
      if (!q) {
        return true;
      }

      return `${item.displayName} ${JSON.stringify(item.data)}`.toLowerCase().includes(q);
    });

  return ok({ relations, items });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("未登录", 401);
    }

    if (user.role !== Role.ADMIN) {
      return fail("无权限", 403);
    }

    const input = createRelationSchema.parse(await request.json());

    if (input.sourcePoolId === input.targetPoolId && input.sourceItemId === input.targetItemId) {
      return fail("不能关联同一个资源");
    }

    const [sourceItem, targetItem] = await Promise.all([
      prisma.poolItem.findFirst({
        where: { id: input.sourceItemId, poolId: input.sourcePoolId }
      }),
      prisma.poolItem.findFirst({
        where: { id: input.targetItemId, poolId: input.targetPoolId }
      })
    ]);

    if (!sourceItem || !targetItem) {
      return fail("资源不存在或池子不匹配", 404);
    }

    const existing = await prisma.relation.findFirst({
      where: {
        OR: [
          {
            sourcePoolId: input.sourcePoolId,
            sourceItemId: input.sourceItemId,
            targetPoolId: input.targetPoolId,
            targetItemId: input.targetItemId
          },
          {
            sourcePoolId: input.targetPoolId,
            sourceItemId: input.targetItemId,
            targetPoolId: input.sourcePoolId,
            targetItemId: input.sourceItemId
          }
        ]
      }
    });

    if (existing) {
      return fail("关联已存在", 409);
    }

    const relation = await prisma.relation.create({
      data: {
        sourcePoolId: input.sourcePoolId,
        sourceItemId: input.sourceItemId,
        targetPoolId: input.targetPoolId,
        targetItemId: input.targetItemId,
        note: input.note,
        createdById: user.id
      },
      include: relationIncludes()
    });

    return ok({ relation }, { status: 201 });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
