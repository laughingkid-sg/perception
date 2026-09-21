import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateWeightedAverageReturn,
  calculateProjection,
  createSchedule,
} from '../src/lib/calculations.ts';

void test('weighted average return uses invested amounts as allocation weights', () => {
  const weightedReturn = calculateWeightedAverageReturn([
    { amount: 10_000, annualReturn: 5 },
    { amount: 30_000, annualReturn: 7 },
  ]);

  assert.equal(weightedReturn, 6.5);
  assert.equal(
    calculateWeightedAverageReturn([{ amount: 0, annualReturn: 8 }]),
    0,
  );
});

void test('annual compounding matches the reference five-year example', () => {
  const result = calculateProjection({
    initialInvestment: 20_000,
    schedule: createSchedule(5, 0, 5_000, 5),
    compounding: 'annually',
    contributionTiming: 'beginning',
  });

  assert.ok(Math.abs(result.endingBalance - 54_535.20) < 0.01);
  assert.equal(result.totalContributions, 25_000);
  assert.ok(Math.abs(result.totalInterest - 9_535.20) < 0.01);
});

void test('end-of-period contributions earn less than beginning contributions', () => {
  const schedule = createSchedule(7, 500, 5_000, 5);
  const beginning = calculateProjection({
    initialInvestment: 20_000,
    schedule,
    compounding: 'monthly',
    contributionTiming: 'beginning',
  });
  const end = calculateProjection({
    initialInvestment: 20_000,
    schedule,
    compounding: 'monthly',
    contributionTiming: 'end',
  });

  assert.ok(beginning.endingBalance > end.endingBalance);
});

void test('each year can use its own contributions and interest rate', () => {
  const schedule = createSchedule(2, 0, 0, 0);
  schedule[0].monthlyContributions[0] = 1_000;
  schedule[0].annualRate = 10;
  schedule[1].annualContribution = 2_000;
  schedule[1].annualRate = 0;

  const result = calculateProjection({
    initialInvestment: 10_000,
    schedule,
    compounding: 'annually',
    contributionTiming: 'beginning',
  });

  assert.ok(Math.abs(result.years[0].endingBalance - 12_100) < 0.01);
  assert.ok(Math.abs(result.endingBalance - 14_100) < 0.01);
  assert.equal(result.totalContributions, 3_000);
});

void test('zero-rate plans add deposits without interest', () => {
  const result = calculateProjection({
    initialInvestment: 10_000,
    schedule: createSchedule(3, 100, 1_000, 0),
    compounding: 'daily',
    contributionTiming: 'end',
  });

  assert.equal(result.endingBalance, 16_600);
  assert.equal(result.totalInterest, 0);
});
