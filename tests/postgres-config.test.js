import test from 'node:test';
import assert from 'node:assert/strict';

import { dbConfig } from '../src/db/config.js';

test('database config resolves PostgreSQL settings from environment', () => {
  assert.equal(dbConfig.development.dialect, 'postgres');
  assert.ok(dbConfig.development.host);
  assert.ok(dbConfig.development.database);
});
