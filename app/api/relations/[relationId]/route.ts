import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, getErrorMessage, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { updateRelationNoteSchema } from "@/lib/validators";
import { toInt } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ relationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("未登录", 401);
    }

    if (user.role !== Role.ADMIN) {
      return fail("无权限", 403);
    }

    const { relationId } = await context.params;
    const id = toInt(relationId);

    if (!id) {
      return fail("无效关联 ID");
    }

    const input = updateRelationNoteSchema.parse(await request.json());
    const relation = await prisma.relation.update({
      where: { id },
      data: { note: input.note || null }
    });

    return ok({ relation });
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

    const { relationId } = await context.params;
    const id = toInt(relationId);

    if (!id) {
      return fail("无效关联 ID");
    }

    await prisma.relation.delete({ where: { id } });

    return ok({ success: true });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
