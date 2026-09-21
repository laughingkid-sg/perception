export type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type CacheEnvelope<Value> = {
  version: 1;
  savedAt: string;
  data: Value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function loadLocalCache<Value>(
  storage: LocalStorageLike,
  key: string,
): Value | null {
  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) return null;

    const parsed: unknown = JSON.parse(rawValue);
    if (
      isRecord(parsed) &&
      parsed.version === 1 &&
      typeof parsed.savedAt === 'string' &&
      'data' in parsed
    ) {
      return parsed.data as Value;
    }

    // Preserve plans saved before the versioned cache wrapper was introduced.
    return parsed as Value;
  } catch {
    return null;
  }
}

export function saveLocalCache<Value>(
  storage: LocalStorageLike,
  key: string,
  data: Value,
): string | null {
  try {
    const savedAt = new Date().toISOString();
    const envelope: CacheEnvelope<Value> = { version: 1, savedAt, data };
    storage.setItem(key, JSON.stringify(envelope));
    return savedAt;
  } catch {
    return null;
  }
}
