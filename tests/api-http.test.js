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
  await request(app).post(`/api/requests/${id}/assignees`).send([
    { userId: 'tech-lead', role: 'lead' },
    { userId: 'tech-member', role: 'member' },
  ]).expect(201);
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

test('API returns site summary and equipment load report', async () => {
  const equipmentRepository = createMemoryRepository([
    { id: 'eq-1', siteId: 'site-1', name: 'Турбина A-1', type: 'turbine', serialNumber: 'WT-001', status: 'operational', installedAt: '2020-01-01T00:00:00.000Z' },
    { id: 'eq-2', siteId: 'site-1', name: 'Турбина B-2', type: 'turbine', serialNumber: 'WT-002', status: 'maintenance', installedAt: '2020-01-02T00:00:00.000Z' },
  ]);
  const requestRepository = createMemoryRepository([
    { id: 'req-1', equipmentId: 'eq-1', title: 'Проверить турбину', priority: 'high', status: 'done', createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z', assignees: [{ userId: 'tech-1', role: 'lead' }], assignedTechnicians: [{ userId: 'tech-1', role: 'lead' }], statusHistory: [] },
    { id: 'req-2', equipmentId: 'eq-1', title: 'Сменить датчик', priority: 'medium', status: 'in_progress', createdAt: '2026-09-02T09:00:00.000Z', updatedAt: '2026-09-02T09:30:00.000Z', assignees: [{ userId: 'tech-2', role: 'lead' }], assignedTechnicians: [{ userId: 'tech-2', role: 'lead' }], statusHistory: [] },
    { id: 'req-3', equipmentId: 'eq-2', title: 'Проверить узел', priority: 'low', status: 'rejected', createdAt: '2026-09-03T08:00:00.000Z', updatedAt: '2026-09-03T09:00:00.000Z', assignees: [], assignedTechnicians: [], statusHistory: [] },
  ]);

  const equipmentService = createEquipmentService(equipmentRepository);
  const requestService = createRequestService(requestRepository, equipmentRepository);
  const app = createApp({ equipmentService, requestService, weatherClient: async () => ({ daily: { time: ['2026-09-18'], precipitation_sum: [0], wind_speed_10m_max: [3] } }) });

  const summary = await request(app).get('/api/sites/site-1/summary').expect(200);
  assert.equal(summary.body.data.siteId, 'site-1');
  assert.equal(summary.body.data.totalRequests, 3);
  assert.equal(summary.body.data.byStatus.in_progress, 1);
  assert.equal(summary.body.data.byPriority.high, 1);

  const load = await request(app).get('/api/reports/equipment-load?period=all&minRequests=1').expect(200);
  assert.equal(load.body.data.period, 'all');
  assert.ok(Array.isArray(load.body.data.data));
  assert.ok(load.body.data.data.some((item) => item.equipmentId === 'eq-1' && item.totalRequests >= 2));
});