import { FieldType } from "@prisma/client";
import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码")
});

export const poolFieldSchema = z.object({
  id: z.number().optional(),
  fieldName: z
    .string()
    .trim()
    .min(1, "字段名不能为空")
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "字段名必须以字母开头，只能包含字母、数字和下划线"),
  label: z.string().trim().optional().default(""),
  fieldType: z.nativeEnum(FieldType).default(FieldType.TEXT),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0)
});

export const createPoolSchema = z.object({
  name: z.string().trim().min(1, "池子名称不能为空"),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional().default(""),
  fields: z.array(poolFieldSchema).min(1, "至少需要一个字段")
});

export const updatePoolSchema = createPoolSchema.partial().extend({
  fields: z.array(poolFieldSchema).optional()
});

export const itemDataSchema = z.object({
  data: z.record(z.unknown())
});

export const createRelationSchema = z.object({
  sourcePoolId: z.number().int().positive(),
  sourceItemId: z.number().int().positive(),
  targetPoolId: z.number().int().positive(),
  targetItemId: z.number().int().positive(),
  note: z.string().trim().optional()
});
