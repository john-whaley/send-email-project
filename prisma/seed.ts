import { FieldType, Prisma, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function upsertPool(
  name: string,
  description: string,
  fields: Array<{
    fieldName: string;
    label: string;
    fieldType?: FieldType;
    required?: boolean;
    unique?: boolean;
  }>
) {
  const pool = await prisma.pool.upsert({
    where: { slug: slugify(name) },
    create: {
      name,
      slug: slugify(name),
      description,
      fields: {
        create: fields.map((field, index) => ({
          fieldName: field.fieldName,
          label: field.label,
          fieldType: field.fieldType ?? FieldType.TEXT,
          required: field.required ?? false,
          unique: field.unique ?? false,
          sortOrder: index
        }))
      }
    },
    update: { name, description }
  });

  for (const [index, field] of fields.entries()) {
    await prisma.poolField.upsert({
      where: {
        poolId_fieldName: {
          poolId: pool.id,
          fieldName: field.fieldName
        }
      },
      create: {
        poolId: pool.id,
        fieldName: field.fieldName,
        label: field.label,
        fieldType: field.fieldType ?? FieldType.TEXT,
        required: field.required ?? false,
        unique: field.unique ?? false,
        sortOrder: index
      },
      update: {
        label: field.label,
        fieldType: field.fieldType ?? FieldType.TEXT,
        required: field.required ?? false,
        unique: field.unique ?? false,
        sortOrder: index
      }
    });
  }

  return pool;
}

async function createItem(poolId: number, data: Record<string, unknown>) {
  const candidates = await prisma.poolItem.findMany({ where: { poolId } });
  const existing = candidates.find((item) => JSON.stringify(item.data) === JSON.stringify(data));

  if (existing) {
    return existing;
  }

  return prisma.poolItem.create({
    data: {
      poolId,
      data: data as Prisma.InputJsonValue
    }
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("admin123456", 10);
  const userPasswordHash = await bcrypt.hash("user123456", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      passwordHash,
      role: Role.ADMIN
    },
    update: {
      passwordHash,
      role: Role.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { username: "viewer" },
    create: {
      username: "viewer",
      passwordHash: userPasswordHash,
      role: Role.USER
    },
    update: {
      passwordHash: userPasswordHash,
      role: Role.USER
    }
  });

  const platformPool = await upsertPool("平台池", "社交平台、广告平台或业务平台。", [
    { fieldName: "name", label: "平台名称", required: true, unique: true },
    { fieldName: "remark", label: "备注" }
  ]);

  const accountPool = await upsertPool("账号池", "登录账号、运营账号或平台账号。", [
    { fieldName: "username", label: "账号", required: true, unique: true },
    { fieldName: "password", label: "密码", fieldType: FieldType.PASSWORD },
    { fieldName: "remark", label: "备注" }
  ]);

  const phonePool = await upsertPool("手机号池", "手机号及其归属信息。", [
    { fieldName: "phone", label: "手机号", fieldType: FieldType.PHONE, required: true, unique: true },
    { fieldName: "owner", label: "归属人" },
    { fieldName: "remark", label: "备注" }
  ]);

  const proxyPool = await upsertPool("代理池", "代理地址和可用性信息。", [
    { fieldName: "host", label: "主机", required: true },
    { fieldName: "port", label: "端口", fieldType: FieldType.NUMBER, required: true },
    { fieldName: "protocol", label: "协议" },
    { fieldName: "remark", label: "备注" }
  ]);

  await upsertPool("设备池", "设备指纹、设备编号和用途。", [
    { fieldName: "deviceId", label: "设备编号", required: true, unique: true },
    { fieldName: "model", label: "型号" },
    { fieldName: "remark", label: "备注" }
  ]);

  const tiktok = await createItem(platformPool.id, { name: "TikTok", remark: "短视频平台" });
  const facebook = await createItem(platformPool.id, { name: "Facebook", remark: "社交平台" });
  const instagram = await createItem(platformPool.id, { name: "Instagram", remark: "图片与短视频平台" });

  const account001 = await createItem(accountPool.id, {
    username: "account001",
    password: "change-me",
    remark: "测试账号"
  });
  const account002 = await createItem(accountPool.id, {
    username: "account002",
    password: "change-me",
    remark: "运营账号"
  });
  const account003 = await createItem(accountPool.id, {
    username: "account003",
    password: "change-me",
    remark: "备用账号"
  });

  const phone001 = await createItem(phonePool.id, {
    phone: "13800000001",
    owner: "Ops",
    remark: "TikTok 验证"
  });
  const phone002 = await createItem(phonePool.id, {
    phone: "13900000002",
    owner: "Ops",
    remark: "Facebook 验证"
  });

  await createItem(proxyPool.id, {
    host: "127.0.0.1",
    port: 7890,
    protocol: "http",
    remark: "本地示例"
  });

  const relations = [
    [platformPool.id, tiktok.id, accountPool.id, account001.id],
    [platformPool.id, tiktok.id, accountPool.id, account002.id],
    [platformPool.id, tiktok.id, accountPool.id, account003.id],
    [platformPool.id, facebook.id, accountPool.id, account001.id],
    [platformPool.id, instagram.id, accountPool.id, account001.id],
    [accountPool.id, account001.id, phonePool.id, phone001.id],
    [accountPool.id, account002.id, phonePool.id, phone002.id]
  ] as const;

  for (const [sourcePoolId, sourceItemId, targetPoolId, targetItemId] of relations) {
    await prisma.relation.upsert({
      where: {
        sourcePoolId_sourceItemId_targetPoolId_targetItemId: {
          sourcePoolId,
          sourceItemId,
          targetPoolId,
          targetItemId
        }
      },
      create: {
        sourcePoolId,
        sourceItemId,
        targetPoolId,
        targetItemId,
        createdById: admin.id
      },
      update: {}
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
