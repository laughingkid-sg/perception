export interface Tariff {
  quarter: string;
  startMonth: string;
  endMonth: string;
  centsPerKwhBeforeGst: number;
  gstRate: number;
  sourceUrl: string;
}

export interface MonthEntry {
  usage: string;
}
export interface CalculatorState {
  retailer: string;
  rebate: string;
  startMonth: string;
  rate: string;
  rateIncludesGst: boolean;
  inputGstRate: number;
  showGst: boolean;
  entries: Record<string, MonthEntry>;
}

export function currentMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

export const isMonth = (value: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
export function monthsBetween(start: string, end: string): string[] {
  if (!isMonth(start) || !isMonth(end) || start > end) return [];
  const [year, month] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const months = [];
  for (let n = year * 12 + month - 1; n <= endYear * 12 + endMonth - 1; n++) {
    months.push(`${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`);
  }
  return months;
}

export function parseAmount(value: string): number | null {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function tariffForMonth(tariffs: Tariff[], month: string): Tariff | undefined {
  return tariffs.find((t) => month >= t.startMonth && month <= t.endMonth);
}

const roundMoney = (number: number) => Math.round((number + Number.EPSILON) * 100) / 100;

export function calculate(state: CalculatorState, tariffs: Tariff[], throughMonth: string) {
  const enteredRate = parseAmount(state.rate);
  const beforeGstRate =
    enteredRate === null
      ? null
      : enteredRate / (state.rateIncludesGst ? 1 + state.inputGstRate : 1);
  let cumulative = 0;
  const rows = monthsBetween(state.startMonth, throughMonth).map((month) => {
    const entry = state.entries[month] ?? { usage: "" };
    const usage = parseAmount(entry.usage);
    const tariff = tariffForMonth(tariffs, month);
    const factor = state.showGst && tariff ? 1 + tariff.gstRate : 1;
    const spBill =
      usage !== null && tariff
        ? roundMoney(((usage * tariff.centsPerKwhBeforeGst) / 100) * factor)
        : null;
    const retailerBill =
      usage !== null && beforeGstRate !== null && tariff
        ? roundMoney(((usage * beforeGstRate) / 100) * factor)
        : null;
    const energySavings =
      spBill !== null && retailerBill !== null ? roundMoney(spBill - retailerBill) : null;
    const savings = energySavings;
    cumulative = roundMoney(cumulative + (energySavings ?? 0));
    return {
      month,
      entry,
      usage,
      tariff,
      spBill,
      retailerBill,
      energySavings,
      savings,
      cumulative,
    };
  });
  const comparable = rows.filter((row) => row.energySavings !== null);
  const sum = (values: number[]) => roundMoney(values.reduce((total, value) => total + value, 0));
  const energySavings = sum(comparable.map((row) => row.energySavings!));
  const rebates = state.startMonth <= throughMonth ? roundMoney(parseAmount(state.rebate) ?? 0) : 0;
  return {
    rows,
    beforeGstRate,
    energySavings,
    rebates,
    totalSavings: roundMoney(energySavings + rebates),
    invalidRebate: state.rebate.trim() !== "" && parseAmount(state.rebate) === null,
    spTotal: sum(comparable.map((row) => row.spBill!)),
    retailerTotal: sum(comparable.map((row) => row.retailerBill!)),
    totalUsage: sum(comparable.map((row) => row.usage!)),
    recordedMonths: comparable.length,
    missingMonths: rows.filter((row) => row.usage === null).length,
    unavailableMonths: rows.filter((row) => row.usage !== null && !row.tariff).length,
    invalidMonths: rows.filter((row) => row.entry.usage.trim() !== "" && row.usage === null).length,
  };
}

export function formatMonth(month: string, short = false): string {
  return new Intl.DateTimeFormat("en-SG", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}
