import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, getErrorMessage, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { updatePoolSchema } from "@/lib/validators";
import { slugify, toInt } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return fail("未登录", 401);
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
      _count: { select: { items: true } }
    }
  });

  if (!pool) {
    return fail("池子不存在", 404);
  }

  return ok({ pool });
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

    const { poolId } = await context.params;
    const id = toInt(poolId);

    if (!id) {
      return fail("无效池子 ID");
    }

    const input = updatePoolSchema.parse(await request.json());
    const slug = input.slug?.trim() || (input.name ? slugify(input.name) : undefined);

    const pool = await prisma.$transaction(async (tx) => {
      const updated = await tx.pool.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(slug ? { slug } : {}),
          ...(input.description !== undefined ? { description: input.description } : {})
        }
      });

      if (input.fields) {
        await tx.poolField.deleteMany({ where: { poolId: id } });
        await tx.poolField.createMany({
          data: input.fields.map((field, index) => ({
            poolId: id,
            fieldName: field.fieldName,
            label: field.label || field.fieldName,
            fieldType: field.fieldType,
            required: field.required,
            unique: field.unique,
            sortOrder: index
          }))
        });
      }

      return tx.pool.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          fields: { orderBy: { sortOrder: "asc" } },
          _count: { select: { items: true } }
        }
      });
    });

    return ok({ pool });
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

    const { poolId } = await context.params;
    const id = toInt(poolId);

    if (!id) {
      return fail("无效池子 ID");
    }

    await prisma.pool.delete({ where: { id } });

    return ok({ success: true });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
