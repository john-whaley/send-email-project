import { Prisma, Role } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { fail, getErrorMessage, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { assertNoDuplicateKeyFields, normalizeItemData } from "@/lib/resource";
import { toInt } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("未登录", 401);
    }

    if (user.role !== Role.ADMIN) {
      return fail("无权限", 403);
    }

    const formData = await request.formData();
    const poolId = toInt(String(formData.get("poolId") ?? ""));
    const file = formData.get("file");

    if (!poolId) {
      return fail("请选择池子");
    }

    if (!(file instanceof File)) {
      return fail("请选择 CSV 或 Excel 文件");
    }

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        items: { select: { id: true, data: true } }
      }
    });

    if (!pool) {
      return fail("池子不存在", 404);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return fail("文件没有可导入的工作表");
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
      defval: ""
    });

    if (!rows.length) {
      return fail("文件没有数据");
    }

    let imported = 0;
    const errors: Array<{ row: number; error: string }> = [];
    const knownItems = [...pool.items];

    for (const [index, row] of rows.entries()) {
      try {
        const data = normalizeItemData(pool.fields, row);
        assertNoDuplicateKeyFields(pool.fields, knownItems, data);
        const item = await prisma.poolItem.create({
          data: {
            poolId,
            data: data as Prisma.InputJsonValue
          }
        });
        knownItems.push(item);
        imported += 1;
      } catch (error) {
        errors.push({
          row: index + 2,
          error: getErrorMessage(error)
        });
      }
    }

    return ok({ imported, failed: errors.length, errors });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
