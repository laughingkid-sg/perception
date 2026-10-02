import { isMonth, parseAmount, type CalculatorState } from "./calculations.ts";

export const STORAGE_KEY = "perception:electricity-savings:v2";
export const LEGACY_STORAGE_KEY = "perception:electricity-savings:v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

export function loadState(storage: StorageLike): CalculatorState | null {
  try {
    const current = storage.getItem(STORAGE_KEY);
    const raw: unknown = JSON.parse(current ?? storage.getItem(LEGACY_STORAGE_KEY) ?? "null");
    const version = current === null ? 1 : 2;
    if (!record(raw) || raw.version !== version || !record(raw.data)) return null;
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
      !record(v.entries) ||
      (version === 2 && typeof v.rebate !== "string")
    )
      return null;
    const entries: CalculatorState["entries"] = {};
    let legacyRebateCents = 0;
    let invalidLegacyRebate: string | null = null;
    for (const [month, entry] of Object.entries(v.entries)) {
      if (
        !isMonth(month) ||
        !record(entry) ||
        typeof entry.usage !== "string" ||
        (version === 1 && typeof entry.rebate !== "string")
      )
        return null;
      entries[month] = { usage: entry.usage };
      if (version === 1) {
        const rebate = entry.rebate as string;
        if (rebate.trim() === "") continue;
        const amount = parseAmount(rebate);
        if (amount === null) invalidLegacyRebate ??= rebate;
        else legacyRebateCents += Math.round((amount + Number.EPSILON) * 100);
      }
    }
    // Keep the original v1 record intact. Invalid amounts remain visible for correction.
    return {
      ...v,
      entries,
      rebate:
        version === 2
          ? v.rebate
          : (invalidLegacyRebate ??
            (legacyRebateCents > 0 ? (legacyRebateCents / 100).toFixed(2) : "")),
    } as CalculatorState;
  } catch {
    return null;
  }
}

export function saveState(storage: StorageLike, state: CalculatorState): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, data: state }));
    return true;
  } catch {
    return false;
  }
}
