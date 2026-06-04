import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, getErrorMessage, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createPoolSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return fail("未登录", 401);
  }

  const pools = await prisma.pool.findMany({
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  return ok({ pools });
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

    const input = createPoolSchema.parse(await request.json());
    const slug = input.slug?.trim() || slugify(input.name);

    const pool = await prisma.$transaction(async (tx) => {
      const sourceItems = input.copyItemsFromPoolId
        ? await tx.poolItem.findMany({
            where: { poolId: input.copyItemsFromPoolId },
            orderBy: { id: "asc" },
            select: { data: true }
          })
        : [];

      if (input.copyItemsFromPoolId && sourceItems.length === 0) {
        const sourcePool = await tx.pool.findUnique({
          where: { id: input.copyItemsFromPoolId },
          select: { id: true }
        });

        if (!sourcePool) {
          throw new Error("复制来源池子不存在");
        }
      }

      const created = await tx.pool.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          fields: {
            create: input.fields.map((field, index) => ({
              fieldName: field.fieldName,
              label: field.label || field.fieldName,
              fieldType: field.fieldType,
              required: field.required,
              unique: field.unique,
              sortOrder: index
            }))
          }
        }
      });

      if (sourceItems.length) {
        await tx.poolItem.createMany({
          data: sourceItems.map((item) => ({
            poolId: created.id,
            data: item.data as Prisma.InputJsonValue
          }))
        });
      }

      return tx.pool.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          fields: { orderBy: { sortOrder: "asc" } },
          _count: { select: { items: true } }
        }
      });
    });

    return ok({ pool }, { status: 201 });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
