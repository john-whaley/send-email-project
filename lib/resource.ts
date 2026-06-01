import type { PoolField, PoolItem } from "@prisma/client";

type JsonObject = Record<string, unknown>;

const PREFERRED_LABEL_FIELDS = [
  "name",
  "username",
  "email",
  "phone",
  "host",
  "deviceId",
  "title",
  "label"
];

export function asRecord(data: unknown): JsonObject {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as JsonObject)
    : {};
}

export function getItemDisplayName(
  item: Pick<PoolItem, "id" | "data">,
  fields?: Array<Pick<PoolField, "fieldName">>
) {
  const data = asRecord(item.data);
  const fieldNames = fields?.map((field) => field.fieldName) ?? [];
  const candidates = [...PREFERRED_LABEL_FIELDS, ...fieldNames];

  for (const key of candidates) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return `资源 #${item.id}`;
}

export function normalizeItemData(
  fields: Array<Pick<PoolField, "fieldName" | "fieldType" | "required">>,
  rawData: Record<string, unknown>
) {
  const data: Record<string, unknown> = {};

  for (const field of fields) {
    const rawValue = rawData[field.fieldName];
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;

    if (field.required && (value === undefined || value === null || value === "")) {
      throw new Error(`${field.fieldName} 为必填字段`);
    }

    if (value === undefined || value === "") {
      data[field.fieldName] = "";
      continue;
    }

    if (field.fieldType === "NUMBER") {
      const numberValue = Number(value);
      if (Number.isNaN(numberValue)) {
        throw new Error(`${field.fieldName} 必须是数字`);
      }
      data[field.fieldName] = numberValue;
      continue;
    }

    if (field.fieldType === "BOOLEAN") {
      data[field.fieldName] = value === true || value === "true" || value === "1";
      continue;
    }

    if (field.fieldType === "JSON") {
      if (typeof value === "string") {
        try {
          data[field.fieldName] = JSON.parse(value);
        } catch {
          throw new Error(`${field.fieldName} 必须是合法 JSON`);
        }
      } else {
        data[field.fieldName] = value;
      }
      continue;
    }

    data[field.fieldName] = String(value);
  }

  return data;
}

export function maskSensitiveValue(fieldName: string, value: unknown) {
  const lowerName = fieldName.toLowerCase();

  if (lowerName.includes("password") || lowerName.includes("token") || lowerName.includes("secret")) {
    return value ? "******" : "";
  }

  return value;
}
