import { loadLocalCache, saveLocalCache, type LocalStorageLike } from './local-cache.ts';

export type SavedPlan<Value> = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: Value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function loadSavedPlans<Value>(
  storage: LocalStorageLike,
  key: string,
): SavedPlan<Value>[] {
  const saved = loadLocalCache<unknown>(storage, key);
  if (!Array.isArray(saved)) return [];

  return saved.filter(
    (record): record is SavedPlan<Value> =>
      isRecord(record) &&
      typeof record.id === 'string' &&
      typeof record.name === 'string' &&
      typeof record.createdAt === 'string' &&
      typeof record.updatedAt === 'string' &&
      'data' in record,
  );
}

export function storeSavedPlans<Value>(
  storage: LocalStorageLike,
  key: string,
  records: SavedPlan<Value>[],
) {
  return saveLocalCache(storage, key, records);
}

export function createSavedPlan<Value>(input: {
  id: string;
  name: string;
  savedAt: string;
  data: Value;
}): SavedPlan<Value> {
  return {
    id: input.id,
    name: input.name.trim(),
    createdAt: input.savedAt,
    updatedAt: input.savedAt,
    data: input.data,
  };
}

export function serializeSavedPlans<Value>(
  records: SavedPlan<Value>[],
  exportedAt = new Date().toISOString(),
) {
  return JSON.stringify(
    {
      kind: 'compound-interest-planner-saves',
      version: 1,
      exportedAt,
      records,
    },
    null,
    2,
  );
}
