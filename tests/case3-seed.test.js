import test from 'node:test';
import assert from 'node:assert/strict';

import { up as seedCase3 } from '../src/db/seeders/202610030001-case3-data.js';

test('Case 3 seed creates the required relational demo dataset', async () => {
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = '.case3-test-data-does-not-exist';
  const inserts = new Map();
  const queryInterface = {
    async bulkInsert(table, records) {
      inserts.set(table, records);
    },
  };

  try {
    await seedCase3(queryInterface);
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
  }

  assert.equal(inserts.get('sites').length, 2);
  assert.equal(inserts.get('equipment').length, 6);
  assert.equal(inserts.get('maintenance_requests').length, 20);
  assert.equal(inserts.get('technicians').length, 5);
  assert.equal(inserts.get('equipment_passports').length, 6);
  assert.equal(inserts.get('request_assignees').length, 20);
  assert.ok(inserts.get('request_status_history').length > 0);

  const requestIds = new Set(inserts.get('maintenance_requests').map((request) => request.id));
  const technicianIds = new Set(inserts.get('technicians').map((technician) => technician.id));
  for (const assignee of inserts.get('request_assignees')) {
    assert.ok(requestIds.has(assignee.request_id));
    assert.ok(technicianIds.has(assignee.technician_id));
  }
});
