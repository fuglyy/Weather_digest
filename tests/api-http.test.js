import { test } from '@jest/globals';
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
  return { app: createApp({ equipmentService, requestService, databaseHealthCheck: async () => {}, weatherClient: async () => ({ daily: { time: ['2026-09-18'], precipitation_sum: [0], wind_speed_10m_max: [3] } }) }), equipmentService, requestService };
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
  const history = await request(app).get(`/api/requests/${id}/history`).expect(200);
  assert.deepEqual(history.body.data.map((entry) => [entry.oldStatus, entry.newStatus]), [
    ['new', 'in_progress'],
    ['in_progress', 'done'],
  ]);
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

test('health reports an unavailable PostgreSQL connection', async () => {
  const previous = process.env.USE_POSTGRES;
  process.env.USE_POSTGRES = 'true';
  try {
    const app = createApp({ databaseHealthCheck: async () => { throw new Error('database offline'); } });
    const response = await request(app).get('/api/health').expect(503);
    assert.deepEqual(response.body.data, { status: 'unavailable', database: 'disconnected' });
  } finally {
    if (previous === undefined) delete process.env.USE_POSTGRES;
    else process.env.USE_POSTGRES = previous;
  }
});

test('API maps PostgreSQL unique constraint errors to 409', async () => {
  const error = new Error('duplicate key');
  error.parent = { code: '23505' };
  const app = createApp({ equipmentService: { create: async () => { throw error; } } });
  const response = await request(app).post('/api/equipment').send({}).expect(409);
  assert.equal(response.body.error.code, 'CONFLICT');
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
  await request(app).get('/api/reports/equipment-load?period=forever').expect(422);
});

test('metrics expose route counters and request duration histogram', async () => {
  const app = createApp({ maintenanceMetrics: async () => '' });
  await request(app).get('/api/health/live').expect(200);
  const response = await request(app).get('/metrics').expect(200);
  assert.match(response.text, /http_requests_total\{method="GET",route="\/api\/health\/live",status="200"\} 1/);
  assert.match(response.text, /http_request_duration_seconds_bucket\{le="\+Inf"\}/);
  assert.match(response.text, /http_request_duration_seconds_count 1/);
});

test('OpenAPI lists authentication, directory and maintenance endpoints', async () => {
  const app = createApp({ maintenanceMetrics: async () => '' });
  const spec = (await request(app).get('/api/openapi.json').expect(200)).body;
  assert.equal(spec.openapi, '3.0.3');
  for (const path of [
    '/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me',
    '/api/sites', '/api/sites/{id}', '/api/technicians', '/api/technicians/{id}',
    '/api/equipment', '/api/requests', '/api/requests/{id}/status', '/api/reports/equipment-load',
  ]) assert.ok(spec.paths[path], `Missing OpenAPI path ${path}`);
  assert.deepEqual(spec.components.securitySchemes.bearerAuth, { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
});

test('directory endpoints delegate list and create to directory service', async () => {
  const createdSite = { id: '11111111-1111-4111-8111-111111111111', name: 'North', code: 'NORTH', region: 'North', lat: 60, lon: 30 };
  const directoryService = {
    listSites: async () => ({ data: [createdSite], meta: { total: 1, page: 1, limit: 20 } }),
    createSite: async (payload) => ({ id: createdSite.id, ...payload }),
    listTechnicians: async () => ({ data: [], meta: { total: 0, page: 1, limit: 20 } }),
  };
  const app = createApp({ directoryService, maintenanceMetrics: async () => '' });
  const sites = await request(app).get('/api/sites').expect(200);
  assert.equal(sites.body.data.data[0].code, 'NORTH');
  const created = await request(app).post('/api/sites').send(createdSite).expect(201);
  assert.equal(created.body.data.name, 'North');
  await request(app).get('/api/technicians').expect(200);
});