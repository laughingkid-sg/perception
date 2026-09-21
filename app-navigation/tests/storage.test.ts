import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampPosition,
  defaultLauncherPreferences,
  parseLauncherPreferences,
} from '../src/storage.ts';

test('parses valid launcher preferences', () => {
  assert.deepEqual(
    parseLauncherPreferences('{"collapsed":true,"position":{"x":120,"y":240}}'),
    { collapsed: true, position: { x: 120, y: 240 } },
  );
});

test('falls back safely for malformed or incomplete preferences', () => {
  assert.deepEqual(parseLauncherPreferences('not-json'), defaultLauncherPreferences);
  assert.deepEqual(parseLauncherPreferences('{"collapsed":true,"position":{"x":"bad"}}'), {
    collapsed: true,
    position: null,
  });
});

test('keeps the draggable launcher inside the viewport', () => {
  assert.deepEqual(clampPosition({ x: -40, y: 900 }, { width: 390, height: 844 }), {
    x: 12,
    y: 776,
  });
});
