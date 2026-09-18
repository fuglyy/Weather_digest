import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createEquipmentService } from '../src/services/equipmentService.js';
import { createRequestService } from '../src/services/requestService.js';
import { createMemoryRepository } from '../src/repositories/testRepositories.js';

function createTestApp() {
  const equipmentRepository = createMemoryRepository();
  const requestRepository = createMemoryRepository();
  const equipmentService = createEquipmentService(equipmentRepository);
  const requestService = createRequestService(requestRepository, equipmentRepository);
  return { app: createApp({ equipmentService, requestService, weatherClient: async () => ({ daily: { time: ['2026-09-18'], precipitation_sum: [0], wind_speed_10m_max: [3] } }) }), equipmentService, requestService };
}

const equipmentPayload = { name: 'Турбина A-1', type: 'turbine', serialNumber: 'WT-001', location: { lat: 55.75, lon: 37.61 }, status: 'operational', installedAt: '2020-01-01T00:00:00.000Z' };

test('API creates equipment and request, then validates status transitions', async () => {
  const { app } = createTestApp();
  const equipmentResponse = await request(app).post('/api/equipment').send(equipmentPayload).expect(201);
  assert.equal(equipmentResponse.body.data.name, equipmentPayload.name);
  assert.ok(equipmentResponse.headers.location);

  const requestResponse = await request(app).post('/api/requests').send({ equipmentId: equipmentResponse.body.data.id, title: 'Заменить датчик', priority: 'high' }).expect(201);
  const id = requestResponse.body.data.id;
  await request(app).patch(`/api/requests/${id}/status`).send({ status: 'done' }).expect(409);
  await request(app).patch(`/api/requests/${id}/status`).send({ status: 'in_progress' }).expect(200);
  await request(app).patch(`/api/requests/${id}/status`).send({ status: 'done' }).expect(200);
});

test('API rejects duplicate serial number and returns consistent errors', async () => {
  const { app } = createTestApp();
  await request(app).post('/api/equipment').send(equipmentPayload).expect(201);
  const response = await request(app).post('/api/equipment').send({ ...equipmentPayload, name: 'Другая турбина' }).expect(409);
  assert.equal(response.body.error.code, 'CONFLICT');
  assert.ok(response.body.error.requestId);
});

test('API returns paginated lists and request id for unknown route', async () => {
  const { app } = createTestApp();
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.data.status, 'ok');
  const list = await request(app).get('/api/equipment?page=1&limit=10').expect(200);
  assert.deepEqual(list.body.data.meta, { total: 0, page: 1, limit: 10 });
  const missing = await request(app).get('/api/missing').expect(404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');
  assert.ok(missing.body.error.requestId);
});