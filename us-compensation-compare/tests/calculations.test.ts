import assert from 'node:assert/strict';
import test from 'node:test';

import {
  US_401K_LIMIT_2026,
  californiaIncomeTax2026SingleEstimate,
  calculateSingapore,
  calculateUnitedStates,
  newYorkCityIncomeTaxSingleEstimate,
  newYorkStateIncomeTax2026SingleEstimate,
  singaporeResidentTax,
  usFederalTax2026Single,
} from '../src/lib/calculations.ts';

const calculateUsScenario = (
  overrides: Partial<Parameters<typeof calculateUnitedStates>[0]> = {},
) =>
  calculateUnitedStates({
    base: 0,
    bonus: 0,
    equity: 0,
    benefits: [],
    expenses: [],
    traditional401k: 0,
    roth401k: 0,
    healthPremiumMonthly: 0,
    hsaContribution: 0,
    hsaEligible: false,
    hsaCoverage: 'self',
    otherSection125: 0,
    employer401kMatch: 0,
    federalMode: 'automatic',
    manualFederalTax: 0,
    stateMode: 'annual',
    stateValue: 0,
    ...overrides,
  });

void test('2026 U.S. single-filer progressive tax matches IRS examples', () => {
  assert.equal(usFederalTax2026Single(83_900), 13_170);
  assert.equal(usFederalTax2026Single(183_900), 36_734);
  assert.equal(usFederalTax2026Single(233_900), 51_304);
});

void test('2026 U.S. FICA applies the Social Security cap and Additional Medicare', () => {
  const result = calculateUsScenario({
    base: 250_000,
  });

  assert.equal(result.federalIncomeTax, 51_304);
  assert.equal(result.employeeFica, 15_514);
  assert.equal(result.employerFica, 15_064);
});

void test('2026 California estimate uses progressive tax and adds SDI separately', () => {
  const result = calculateUsScenario({
    base: 180_000,
    stateMode: 'california',
  });

  assert.ok(
    Math.abs(californiaIncomeTax2026SingleEstimate(174_294) - 12_494.98) < 0.01,
  );
  assert.ok(Math.abs(result.stateLocalTax - 12_494.98) < 0.01);
  assert.equal(result.statePayrollTax, 2_340);
  assert.equal(
    result.employeeStatutory,
    result.employeeFica + result.statePayrollTax,
  );
});

void test('HSA is capped and remains in California taxable income', () => {
  const result = calculateUsScenario({
    base: 100_000,
    hsaContribution: 5_000,
    hsaEligible: true,
    stateMode: 'california',
  });

  assert.equal(result.hsaContribution, 4_400);
  assert.equal(result.federalTaxableIncome, 79_500);
  assert.equal(result.stateTaxableIncome, 94_294);
  assert.equal(result.statePayrollTax, 1_300);
});

void test('Seattle preset applies Washington Paid Leave and WA Cares without income tax', () => {
  const result = calculateUsScenario({
    base: 200_000,
    stateMode: 'washington',
  });

  assert.equal(result.stateLocalTax, 0);
  assert.ok(Math.abs(result.statePayrollTax - 2_649.21) < 0.01);
});

void test('New York City preset combines state, city, and Paid Family Leave', () => {
  const result = calculateUsScenario({
    base: 180_000,
    stateMode: 'new-york-city',
  });

  assert.equal(result.stateTaxableIncome, 172_000);
  assert.ok(
    Math.abs(newYorkStateIncomeTax2026SingleEstimate(172_000) - 9_579.75) <
      0.01,
  );
  assert.ok(
    Math.abs(newYorkCityIncomeTaxSingleEstimate(172_000) - 6_541.89) < 0.01,
  );
  assert.ok(Math.abs(result.stateLocalTax - 16_121.64) < 0.01);
  assert.equal(result.statePayrollTax, 411.91);
});

void test('Texas preset has no individual state income or payroll tax', () => {
  const result = calculateUsScenario({
    base: 180_000,
    stateMode: 'texas',
  });

  assert.equal(result.stateLocalTax, 0);
  assert.equal(result.statePayrollTax, 0);
});

void test('combined Traditional and Roth 401(k) contributions use the 2026 employee cap', () => {
  const result = calculateUsScenario({
    base: 100_000,
    traditional401k: 20_000,
    roth401k: 10_000,
    employer401kMatch: 5_000,
  });

  assert.equal(result.traditional401k, 20_000);
  assert.equal(result.roth401k, 4_500);
  assert.equal(result.employeeVoluntary, US_401K_LIMIT_2026);
  assert.equal(result.wealthAccumulation, result.disposableIncome + 29_500);
});

void test('Singapore resident schedule reaches published cumulative tax values', () => {
  assert.equal(singaporeResidentTax(320_000), 44_550);
  assert.equal(singaporeResidentTax(500_000), 84_150);
  assert.equal(singaporeResidentTax(1_000_000), 199_150);
});

void test('2026 Singapore CPF ceiling caps full-rate annual contributions', () => {
  const result = calculateSingapore({
    base: 180_000,
    bonus: 30_000,
    equity: 25_000,
    benefits: [],
    expenses: [],
    cpfStatus: 'full',
    ageBand: '55-and-below',
    taxResident: true,
    otherReliefs: 0,
  });

  assert.equal(result.cpfWages, 102_000);
  assert.equal(result.employeeCpf, 20_400);
  assert.equal(result.employerCpf, 17_340);
});

void test('package-only benefits do not inflate spendable cash', () => {
  const result = calculateSingapore({
    base: 100_000,
    bonus: 0,
    equity: 0,
    benefits: [
      {
        id: 'insurance',
        name: 'Insurance',
        amount: 5_000,
        mode: 'package-nontaxable',
      },
    ],
    expenses: [],
    cpfStatus: 'none',
    ageBand: '55-and-below',
    taxResident: true,
    otherReliefs: 0,
  });

  assert.equal(result.grossCash, 100_000);
  assert.equal(result.employerPackage, 105_000);
});
