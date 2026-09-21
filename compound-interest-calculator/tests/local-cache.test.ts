import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type LocalStorageLike,
  loadLocalCache,
  saveLocalCache,
} from '../src/lib/local-cache.ts';

function memoryStorage(initial: Record<string, string> = {}): LocalStorageLike {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

void test('saved calculator values survive a cache round trip', () => {
  const storage = memoryStorage();
  const plan = {
    settings: { years: 7, initialInvestment: 20_000 },
    schedule: [{ year: 1, annualRate: 5 }],
  };

  const savedAt = saveLocalCache(storage, 'plan', plan);

  assert.ok(savedAt);
  assert.deepEqual(loadLocalCache(storage, 'plan'), plan);
});

void test('legacy unwrapped values are migrated without losing the plan', () => {
  const legacyPlan = { settings: { years: 5 }, schedule: [] };
  const storage = memoryStorage({ plan: JSON.stringify(legacyPlan) });

  assert.deepEqual(loadLocalCache(storage, 'plan'), legacyPlan);
});

void test('invalid cache data is ignored safely', () => {
  const storage = memoryStorage({ plan: '{not-json' });

  assert.equal(loadLocalCache(storage, 'plan'), null);
});
