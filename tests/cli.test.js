import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../src/cli/args.js';

test('parseArgs accepts valid city and days values', () => {
  const args = ['--city', 'Нижний Новгород, Москва', '--days', '3'];
  const result = parseArgs(args);

  assert.deepEqual(result.cities, ['Нижний Новгород', 'Москва']);
  assert.equal(result.days, 3);
  assert.equal(result.noCache, false);
});

test('parseArgs validates day range', () => {
  assert.throws(() => parseArgs(['--city', 'Москва', '--days', '0']));
  assert.throws(() => parseArgs(['--city', 'Москва', '--days', '8']));
});

test('parseArgs requires city argument', () => {
  assert.throws(() => parseArgs(['--days', '2']));
});
