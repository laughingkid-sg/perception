import assert from "node:assert/strict";
import test from "node:test";
import { loadState, saveState, STORAGE_KEY, LEGACY_STORAGE_KEY } from "../src/lib/storage.ts";
import type { CalculatorState } from "../src/lib/calculations.ts";

const state: CalculatorState = {
  retailer: "Example",
  rebate: "50",
  rate: "21.8",
  rateIncludesGst: true,
  inputGstRate: 0.09,
  showGst: false,
  startMonth: "2026-01",
  entries: { "2026-01": { usage: "0" } },
};
test("persists all settings, zero usage, rebates and out-of-range months", () => {
  let raw = "";
  const storage = {
    getItem: () => raw,
    setItem: (_: string, value: string) => {
      raw = value;
    },
  };
  assert.equal(saveState(storage, state), true);
  assert.deepEqual(loadState(storage), state);
});
test("invalid or obsolete cache is rejected", () => {
  for (const raw of [
    "bad JSON",
    "null",
    "[]",
    JSON.stringify({ version: 3, data: state }),
    JSON.stringify({ version: 2, data: { ...state, startMonth: "2026-13" } }),
    JSON.stringify({ version: 2, data: { ...state, entries: { "2026-01": null } } }),
  ]) {
    assert.equal(loadState({ getItem: () => raw, setItem() {} }), null);
  }
});
test("storage failures do not crash and saving reports failure", () => {
  const storage = {
    getItem(): string {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
  };
  assert.equal(loadState(storage), null);
  assert.equal(saveState(storage, state), false);
});

test("migrates monthly rebates once while retaining original saved data", () => {
  const legacy = JSON.stringify({
    version: 1,
    data: {
      ...state,
      rebate: undefined,
      entries: {
        "2026-01": { usage: "0", rebate: "50" },
        "2026-02": { usage: "100", rebate: "5" },
      },
    },
  });
  const values = new Map([[LEGACY_STORAGE_KEY, legacy]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const migrated = loadState(storage)!;
  assert.equal(migrated.rebate, "55.00");
  assert.deepEqual(migrated.entries, { "2026-01": { usage: "0" }, "2026-02": { usage: "100" } });
  assert.equal(saveState(storage, migrated), true);
  assert.equal(values.get(LEGACY_STORAGE_KEY), legacy);
  assert.deepEqual(loadState(storage), migrated);
  assert.ok(values.has(STORAGE_KEY));
});
test("migration preserves invalid rebate input for correction", () => {
  const legacy = JSON.stringify({
    version: 1,
    data: { ...state, entries: { "2026-01": { usage: "0", rebate: "oops" } } },
  });
  const storage = {
    getItem: (key: string) => (key === LEGACY_STORAGE_KEY ? legacy : null),
    setItem() {},
  };
  assert.equal(loadState(storage)?.rebate, "oops");
});
