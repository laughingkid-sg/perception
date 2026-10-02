import assert from "node:assert/strict";
import test from "node:test";
import { loadState, saveState } from "../src/lib/storage.ts";
import type { CalculatorState } from "../src/lib/calculations.ts";

const state: CalculatorState = {
  retailer: "Example",
  rate: "21.8",
  rateIncludesGst: true,
  inputGstRate: 0.09,
  showGst: false,
  startMonth: "2026-01",
  entries: { "2026-01": { usage: "0", rebate: "50" } },
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
    JSON.stringify({ version: 2, data: state }),
    JSON.stringify({ version: 1, data: { ...state, startMonth: "2026-13" } }),
    JSON.stringify({ version: 1, data: { ...state, entries: { "2026-01": null } } }),
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
