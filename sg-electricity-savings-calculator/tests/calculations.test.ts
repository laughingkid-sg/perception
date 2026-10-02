import assert from "node:assert/strict";
import test from "node:test";
import {
  calculate,
  currentMonth,
  monthsBetween,
  parseAmount,
  type CalculatorState,
  type Tariff,
} from "../src/lib/calculations.ts";

const tariffs: Tariff[] = [
  {
    quarter: "2026-Q1",
    startMonth: "2026-01",
    endMonth: "2026-03",
    centsPerKwhBeforeGst: 30,
    gstRate: 0.09,
    sourceUrl: "https://example.com",
  },
  {
    quarter: "2026-Q2",
    startMonth: "2026-04",
    endMonth: "2026-06",
    centsPerKwhBeforeGst: 35,
    gstRate: 0.09,
    sourceUrl: "https://example.com",
  },
];
const state = (overrides: Partial<CalculatorState> = {}): CalculatorState => ({
  retailer: "",
  rebate: "",
  startMonth: "2026-03",
  rate: "20",
  rateIncludesGst: false,
  inputGstRate: 0.09,
  showGst: false,
  entries: {},
  ...overrides,
});

test("uses each month’s historical quarter, not the latest tariff", () => {
  const result = calculate(
    state({
      rebate: "50",
      entries: {
        "2026-03": { usage: "100" },
        "2026-04": { usage: "100" },
      },
    }),
    tariffs,
    "2026-04",
  );
  assert.equal(result.spTotal, 65);
  assert.equal(result.retailerTotal, 40);
  assert.equal(result.energySavings, 25);
  assert.equal(result.rebates, 50);
  assert.equal(result.totalSavings, 75);
  assert.equal(result.rows[1].cumulative, 25);
});

test("GST-inclusive fixed rate is normalized; rebates are never uplifted", () => {
  const settings = state({
    rebate: "50",
    rate: "21.80",
    rateIncludesGst: true,
    showGst: true,
    entries: { "2026-03": { usage: "100" } },
  });
  const gross = calculate(settings, tariffs, "2026-03");
  const net = calculate({ ...settings, showGst: false }, tariffs, "2026-03");
  assert.equal(gross.totalSavings, 60.9);
  assert.equal(net.totalSavings, 60);
  assert.equal(gross.rebates, net.rebates);
  assert.equal(gross.beforeGstRate, 20);
});

test("blank usage is missing, zero usage is recorded, one-time rebate counts without a bill", () => {
  const result = calculate(
    state({
      rebate: "50",
      entries: { "2026-03": { usage: "" }, "2026-04": { usage: "0" } },
    }),
    tariffs,
    "2026-05",
  );
  assert.equal(result.recordedMonths, 1);
  assert.equal(result.missingMonths, 2);
  assert.equal(result.totalSavings, 50);
  assert.equal(result.rows[0].savings, null);
  assert.equal(result.rows[1].savings, 0);
});

test("usage before start and future records are not counted; plan rebate counts once", () => {
  const result = calculate(
    state({
      rebate: "10",
      entries: {
        "2026-02": { usage: "100" },
        "2026-03": { usage: "100" },
        "2026-04": { usage: "100" },
      },
    }),
    tariffs,
    "2026-03",
  );
  assert.equal(result.totalSavings, 20);
  assert.equal(result.rebates, 10);
});

test("retailer costs above SP produce negative savings", () => {
  const result = calculate(
    state({ rate: "40", rebate: "2", entries: { "2026-03": { usage: "100" } } }),
    tariffs,
    "2026-03",
  );
  assert.equal(result.energySavings, -10);
  assert.equal(result.totalSavings, -8);
});

test("missing published tariffs remain unavailable instead of using stale rates", () => {
  const result = calculate(
    state({ startMonth: "2026-07", entries: { "2026-07": { usage: "100" } } }),
    tariffs,
    "2026-07",
  );
  assert.equal(result.unavailableMonths, 1);
  assert.equal(result.rows[0].spBill, null);
  assert.equal(result.recordedMonths, 0);
});

test("rounds monthly bills before adding the total and calculating differences", () => {
  const result = calculate(
    state({
      rate: "20.015",
      rebate: "0.01",
      entries: { "2026-03": { usage: "1" }, "2026-04": { usage: "1" } },
    }),
    tariffs,
    "2026-04",
  );
  assert.equal(result.spTotal, 0.65);
  assert.equal(result.retailerTotal, 0.4);
  assert.equal(result.totalSavings, 0.26);
});

test("invalid values are exposed; zero and fractional usage are valid", () => {
  for (const value of ["", "-1", "Infinity", "NaN", "1e3", "1,000", "words"])
    assert.equal(parseAmount(value), null);
  assert.equal(parseAmount("0"), 0);
  assert.equal(parseAmount(".5"), 0.5);
  assert.equal(parseAmount(" 30.25 "), 30.25);
  assert.equal(
    calculate(state({ entries: { "2026-03": { usage: "-1" } } }), tariffs, "2026-03").invalidMonths,
    1,
  );
});

test("months cross years and current month uses Singapore time", () => {
  assert.deepEqual(monthsBetween("2026-12", "2027-02"), ["2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(monthsBetween("2026-13", "2027-02"), []);
  assert.deepEqual(monthsBetween("2027-01", "2026-12"), []);
  assert.equal(currentMonth(new Date("2026-09-30T16:00:00Z")), "2026-10");
});

test("one-time rebate is not multiplied by usage months or affected by start-month changes", () => {
  const settings = state({
    rebate: "50",
    entries: { "2026-03": { usage: "100" }, "2026-04": { usage: "100" } },
  });
  assert.equal(calculate(settings, tariffs, "2026-04").totalSavings, 75);
  const changed = calculate({ ...settings, startMonth: "2026-04" }, tariffs, "2026-04");
  assert.equal(changed.rebates, 50);
  assert.equal(changed.totalSavings, 65);
  assert.equal(changed.rows[0].savings, 15);
});
test("invalid one-time rebate is exposed, blank and zero rebates are valid", () => {
  assert.equal(calculate(state({ rebate: "oops" }), tariffs, "2026-03").invalidRebate, true);
  assert.equal(calculate(state({ rebate: "" }), tariffs, "2026-03").invalidRebate, false);
  assert.equal(calculate(state({ rebate: "0" }), tariffs, "2026-03").rebates, 0);
  assert.equal(calculate(state({ rebate: "50" }), tariffs, "2026-03").totalSavings, 50);
});
