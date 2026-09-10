import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateSingapore,
  calculateUnitedStates,
  singaporeResidentTax,
  usFederalTax2026Single,
} from '../lib/calculations.ts';

test('2026 U.S. single-filer progressive tax matches IRS examples', () => {
  assert.equal(usFederalTax2026Single(83_900), 13_170);
  assert.equal(usFederalTax2026Single(183_900), 36_734);
  assert.equal(usFederalTax2026Single(233_900), 51_304);
});

test('2026 U.S. FICA applies the Social Security cap and Additional Medicare', () => {
  const result = calculateUnitedStates({
    base: 250_000,
    bonus: 0,
    equity: 0,
    benefits: [],
    expenses: [],
    retirement401k: 0,
    otherPretax: 0,
    federalMode: 'automatic',
    manualFederalTax: 0,
    stateMode: 'annual',
    stateValue: 0,
  });

  assert.equal(result.federalIncomeTax, 51_304);
  assert.equal(result.employeeFica, 15_514);
  assert.equal(result.employerFica, 15_064);
});

test('Singapore resident schedule reaches published cumulative tax values', () => {
  assert.equal(singaporeResidentTax(320_000), 44_550);
  assert.equal(singaporeResidentTax(500_000), 84_150);
  assert.equal(singaporeResidentTax(1_000_000), 199_150);
});

test('2026 Singapore CPF ceiling caps full-rate annual contributions', () => {
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

test('package-only benefits do not inflate spendable cash', () => {
  const result = calculateSingapore({
    base: 100_000,
    bonus: 0,
    equity: 0,
    benefits: [
      { id: 'insurance', name: 'Insurance', amount: 5_000, mode: 'package-nontaxable' },
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
