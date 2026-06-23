export const POOL_ORDER_STORAGE_KEY = "dashboard.poolOrder";
export const POOL_ORDER_CHANGED_EVENT = "dashboard-pool-order-change";

export type OrderedPool = {
  id: number;
};

export function parseStoredPoolOrder(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

export function orderPoolsByStoredOrder<TPool extends OrderedPool>(pools: TPool[], poolOrder: number[]) {
  if (!poolOrder.length) {
    return pools;
  }

  const fallbackIndex = new Map(pools.map((pool, index) => [pool.id, index]));
  const orderIndex = new Map(poolOrder.map((id, index) => [id, index]));

  return [...pools].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return (fallbackIndex.get(left.id) ?? 0) - (fallbackIndex.get(right.id) ?? 0);
  });
}
