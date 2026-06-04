import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, getErrorMessage, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { bulkIdsSchema, itemDataSchema } from "@/lib/validators";
import { assertNoDuplicateKeyFields, getItemDisplayName, normalizeItemData } from "@/lib/resource";
import { toInt } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return fail("未登录", 401);
  }

  const { poolId } = await context.params;
  const id = toInt(poolId);

  if (!id) {
    return fail("无效池子 ID");
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toLowerCase();

  const pool = await prisma.pool.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: { id: "asc" } }
    }
  });

  if (!pool) {
    return fail("池子不存在", 404);
  }

  const items = query
    ? pool.items.filter((item) => JSON.stringify(item.data).toLowerCase().includes(query))
    : pool.items;

  return ok({
    pool: {
      id: pool.id,
      name: pool.name,
      slug: pool.slug,
      description: pool.description,
      fields: pool.fields
    },
    items: items.map((item) => ({
      ...item,
      displayName: getItemDisplayName(item, pool.fields)
    }))
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("未登录", 401);
    }

    if (user.role !== Role.ADMIN) {
      return fail("无权限", 403);
    }

    const { poolId } = await context.params;
    const id = toInt(poolId);

    if (!id) {
      return fail("无效池子 ID");
    }

    const pool = await prisma.pool.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        items: { select: { id: true, data: true } }
      }
    });

    if (!pool) {
      return fail("池子不存在", 404);
    }

    const input = itemDataSchema.parse(await request.json());
    const data = normalizeItemData(pool.fields, input.data);
    assertNoDuplicateKeyFields(pool.fields, pool.items, data);

    const item = await prisma.poolItem.create({
      data: {
        poolId: id,
        data: data as Prisma.InputJsonValue
      }
    });

    return ok({ item: { ...item, displayName: getItemDisplayName(item, pool.fields) } }, { status: 201 });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("未登录", 401);
    }

    if (user.role !== Role.ADMIN) {
      return fail("无权限", 403);
    }

    const { poolId } = await context.params;
    const id = toInt(poolId);

    if (!id) {
      return fail("无效池子 ID");
    }

    const input = bulkIdsSchema.parse(await request.json());
    const deleted = await prisma.poolItem.deleteMany({
      where: {
        poolId: id,
        id: { in: input.ids }
      }
    });

    return ok({ success: true, deleted: deleted.count });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
