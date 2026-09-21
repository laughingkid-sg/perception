import assert from 'node:assert/strict';
import test from 'node:test';

import { type LocalStorageLike } from '../src/lib/local-cache.ts';
import {
  createSavedPlan,
  loadSavedPlans,
  serializeSavedPlans,
  storeSavedPlans,
} from '../src/lib/saved-plans.ts';

function memoryStorage(): LocalStorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

void test('multiple named plans persist in local storage', () => {
  const storage = memoryStorage();
  const first = createSavedPlan({
    id: 'one',
    name: '  Base plan  ',
    savedAt: '2026-09-21T01:00:00.000Z',
    data: { years: 7 },
  });
  const second = createSavedPlan({
    id: 'two',
    name: 'Raise scenario',
    savedAt: '2026-09-21T02:00:00.000Z',
    data: { years: 10 },
  });

  storeSavedPlans(storage, 'saves', [first, second]);

  assert.equal(first.name, 'Base plan');
  assert.deepEqual(loadSavedPlans(storage, 'saves'), [first, second]);
});

void test('saved plan exports contain a portable versioned record bundle', () => {
  const record = createSavedPlan({
    id: 'one',
    name: 'Base plan',
    savedAt: '2026-09-21T01:00:00.000Z',
    data: { years: 7 },
  });
  const exported = JSON.parse(
    serializeSavedPlans([record], '2026-09-21T03:00:00.000Z'),
  );

  assert.equal(exported.kind, 'compound-interest-planner-saves');
  assert.equal(exported.version, 1);
  assert.deepEqual(exported.records, [record]);
});
