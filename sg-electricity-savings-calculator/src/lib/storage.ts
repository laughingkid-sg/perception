import { isMonth, type CalculatorState } from "./calculations.ts";

export const STORAGE_KEY = "perception:electricity-savings:v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

export function loadState(storage: StorageLike): CalculatorState | null {
  try {
    const raw: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
    if (!record(raw) || raw.version !== 1 || !record(raw.data)) return null;
    const v = raw.data;
    if (
      typeof v.retailer !== "string" ||
      typeof v.startMonth !== "string" ||
      !isMonth(v.startMonth) ||
      v.startMonth < "2026-01" ||
      typeof v.rate !== "string" ||
      typeof v.rateIncludesGst !== "boolean" ||
      typeof v.showGst !== "boolean" ||
      typeof v.inputGstRate !== "number" ||
      !Number.isFinite(v.inputGstRate) ||
      v.inputGstRate < 0 ||
      v.inputGstRate > 1 ||
      !record(v.entries)
    )
      return null;
    for (const [month, entry] of Object.entries(v.entries)) {
      if (
        !isMonth(month) ||
        !record(entry) ||
        typeof entry.usage !== "string" ||
        typeof entry.rebate !== "string"
      )
        return null;
    }
    return v as unknown as CalculatorState;
  } catch {
    return null;
  }
}

export function saveState(storage: StorageLike, state: CalculatorState): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data: state }));
    return true;
  } catch {
    return false;
  }
}
