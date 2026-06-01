import { Role } from "@prisma/client";
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

    const pool = await prisma.pool.create({
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
      },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        _count: { select: { items: true } }
      }
    });

    return ok({ pool }, { status: 201 });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
