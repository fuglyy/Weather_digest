import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeForecastData } from '../src/services/weatherService.js';
import { getReportFilename } from '../src/storage/reportStore.js';

test('getReportFilename preserves Cyrillic city names and keeps them unique', () => {
  const moskvaName = getReportFilename('Москва');
  const kazanName = getReportFilename('Казань');

  assert.match(moskvaName, /^москва-\d{4}-\d{2}-\d{2}\.json$/);
  assert.match(kazanName, /^казань-\d{4}-\d{2}-\d{2}\.json$/);
  assert.notEqual(moskvaName, kazanName);
});

test('normalizeForecastData keeps the expected properties', () => {
  const payload = {
    daily: {
      time: ['2026-09-12', '2026-09-13'],
      temperature_2m_min: [18, 17],
      temperature_2m_max: [23, 25],
      precipitation_sum: [4.5, 2]
    }
  };

  const normalized = normalizeForecastData(payload, 2);

  assert.deepEqual(normalized, [
    { date: '2026-09-12', minTemp: 18, maxTemp: 23, precipitation: 4.5 },
    { date: '2026-09-13', minTemp: 17, maxTemp: 25, precipitation: 2 }
  ]);
});

test('normalizeForecastData throws on malformed forecast response', () => {
  assert.throws(() => normalizeForecastData({ daily: {} }, 1));
});
