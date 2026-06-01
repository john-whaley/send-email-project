import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, getErrorMessage, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { itemDataSchema } from "@/lib/validators";
import { asRecord, getItemDisplayName, normalizeItemData } from "@/lib/resource";
import { toInt } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ poolId: string; itemId: string }>;
};

async function assertUniqueFields(
  poolId: number,
  data: Record<string, unknown>,
  excludeItemId: number
) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { fields: true, items: true }
  });

  if (!pool) {
    throw new Error("池子不存在");
  }

  for (const field of pool.fields.filter((candidate) => candidate.unique)) {
    const value = data[field.fieldName];

    if (value === undefined || value === null || value === "") {
      continue;
    }

    const duplicated = pool.items.find((item) => {
      const itemData = asRecord(item.data);
      return item.id !== excludeItemId && String(itemData[field.fieldName] ?? "") === String(value);
    });

    if (duplicated) {
      throw new Error(`${field.label || field.fieldName} 已存在`);
    }
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return fail("未登录", 401);
  }

  const { poolId, itemId } = await context.params;
  const id = toInt(poolId);
  const itemIdentifier = toInt(itemId);

  if (!id || !itemIdentifier) {
    return fail("无效资源 ID");
  }

  const item = await prisma.poolItem.findFirst({
    where: { id: itemIdentifier, poolId: id },
    include: { pool: { include: { fields: { orderBy: { sortOrder: "asc" } } } } }
  });

  if (!item) {
    return fail("资源不存在", 404);
  }

  return ok({ item: { ...item, displayName: getItemDisplayName(item, item.pool.fields) } });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("未登录", 401);
    }

    if (user.role !== Role.ADMIN) {
      return fail("无权限", 403);
    }

    const { poolId, itemId } = await context.params;
    const id = toInt(poolId);
    const itemIdentifier = toInt(itemId);

    if (!id || !itemIdentifier) {
      return fail("无效资源 ID");
    }

    const pool = await prisma.pool.findUnique({
      where: { id },
      include: { fields: { orderBy: { sortOrder: "asc" } } }
    });

    if (!pool) {
      return fail("池子不存在", 404);
    }

    const existing = await prisma.poolItem.findFirst({
      where: { id: itemIdentifier, poolId: id }
    });

    if (!existing) {
      return fail("资源不存在", 404);
    }

    const input = itemDataSchema.parse(await request.json());
    const data = normalizeItemData(pool.fields, input.data);
    await assertUniqueFields(id, data, itemIdentifier);

    const item = await prisma.poolItem.update({
      where: { id: itemIdentifier },
      data: { data: data as Prisma.InputJsonValue }
    });

    return ok({ item: { ...item, displayName: getItemDisplayName(item, pool.fields) } });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("未登录", 401);
    }

    if (user.role !== Role.ADMIN) {
      return fail("无权限", 403);
    }

    const { poolId, itemId } = await context.params;
    const id = toInt(poolId);
    const itemIdentifier = toInt(itemId);

    if (!id || !itemIdentifier) {
      return fail("无效资源 ID");
    }

    const deleted = await prisma.poolItem.deleteMany({
      where: { id: itemIdentifier, poolId: id }
    });

    if (deleted.count === 0) {
      return fail("资源不存在", 404);
    }

    return ok({ success: true });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
