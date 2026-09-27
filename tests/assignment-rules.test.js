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
  return {
    app: createApp({ equipmentService, requestService, weatherClient: async () => ({ daily: { time: ['2026-09-18'], precipitation_sum: [0], wind_speed_10m_max: [3] } }) }),
    equipmentService,
    requestService,
  };
}

test('API rejects assignment without a single lead', async () => {
  const { app } = createTestApp();

  const equipmentResponse = await request(app).post('/api/equipment').send({
    name: 'Турбина A-1',
    type: 'turbine',
    serialNumber: 'WT-001',
    location: { lat: 55.75, lon: 37.61 },
    status: 'operational',
    installedAt: '2020-01-01T00:00:00.000Z',
  }).expect(201);

  const requestResponse = await request(app).post('/api/requests').send({
    equipmentId: equipmentResponse.body.data.id,
    title: 'Заменить датчик',
    priority: 'high',
  }).expect(201);

  const response = await request(app)
    .post(`/api/requests/${requestResponse.body.data.id}/assignees`)
    .send([
      { userId: 'tech-1', role: 'member' },
      { userId: 'tech-2', role: 'member' },
    ])
    .expect(422);

  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('API rejects in_progress status without assigned technicians', async () => {
  const { app } = createTestApp();

  const equipmentResponse = await request(app).post('/api/equipment').send({
    name: 'Турбина A-2',
    type: 'turbine',
    serialNumber: 'WT-002',
    location: { lat: 55.75, lon: 37.61 },
    status: 'operational',
    installedAt: '2020-01-01T00:00:00.000Z',
  }).expect(201);

  const requestResponse = await request(app).post('/api/requests').send({
    equipmentId: equipmentResponse.body.data.id,
    title: 'Проверить схему',
    priority: 'medium',
  }).expect(201);

  const response = await request(app)
    .patch(`/api/requests/${requestResponse.body.data.id}/status`)
    .send({ status: 'in_progress' })
    .expect(409);

  assert.equal(response.body.error.code, 'CONFLICT');
});
