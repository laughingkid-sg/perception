import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCurrencyInput,
  parseCurrencyInput,
} from '../src/lib/number-format.ts';

void test('currency input removes leading zeros', () => {
  assert.deepEqual(parseCurrencyInput('0001250'), {
    display: '1,250',
    value: 1_250,
  });
});

void test('currency input adds thousands separators and ignores symbols', () => {
  assert.deepEqual(parseCurrencyInput('S$ 1,234,567'), {
    display: '1,234,567',
    value: 1_234_567,
  });
  assert.equal(formatCurrencyInput(20_000), '20,000');
});

void test('empty currency input remains editable and resolves to zero', () => {
  assert.deepEqual(parseCurrencyInput(''), { display: '', value: 0 });
});
