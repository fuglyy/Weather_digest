import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { authService } from '../src/services/authService.js';

const originalAuthRequired = process.env.AUTH_REQUIRED;

function createAuthApp() {
  process.env.AUTH_REQUIRED = 'true';
  return createApp({
    equipmentService: {
      list: async () => ({ data: [], meta: { total: 0, page: 1, limit: 10 } }),
      create: async (payload) => ({ id: 'eq-1', ...payload }),
    },
    requestService: {
      list: async () => ({ data: [], meta: { total: 0, page: 1, limit: 10 } }),
      create: async (payload) => ({ id: 'req-1', ...payload }),
      get: async (id) => ({ id, assignedTechnicians: [{ userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] }),
      changeStatus: async () => ({ id: 'req-1', status: 'in_progress' }),
    },
    databaseHealthCheck: async () => {},
    weatherClient: async () => ({ daily: { time: ['2026-09-18'], precipitation_sum: [0], wind_speed_10m_max: [3] } }),
  });
}

test('auth allows register/login and protected routes require bearer token', async () => {
  const app = createAuthApp();

  const register = await request(app).post('/api/auth/register').send({ email: 'user@example.com', password: 'secret123', role: 'admin' }).expect(201);
  assert.equal(register.body.data.user.email, 'user@example.com');
  assert.equal(register.body.data.user.role, 'viewer');
  assert.equal(Object.hasOwn(register.body.data.user, 'passwordHash'), false);

  const login = await request(app).post('/api/auth/login').send({ email: 'user@example.com', password: 'secret123' }).expect(200);
  assert.ok(login.body.data.accessToken);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/i);
  assert.match(login.headers['set-cookie'][0], /SameSite=Lax/i);

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`).expect(200);
  assert.equal(me.body.data.user.email, 'user@example.com');
  const forbidden = await request(app).post('/api/equipment').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({}).expect(403);
  assert.equal(forbidden.body.error.code, 'FORBIDDEN');
  await request(app).post('/api/sites').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({}).expect(403);
  await request(app).post('/api/auth/users').set('Authorization', `Bearer ${login.body.data.accessToken}`).send({}).expect(403);
  await request(app).get('/api/equipment').set('Authorization', 'Bearer a.b.c').expect(401);

  const docs = await request(app).get('/api/docs').redirects(1).expect(200);
  assert.match(docs.text, /swagger-ui/i);

  const protectedRoute = await request(app).get('/api/equipment').expect(401);
  assert.equal(protectedRoute.body.error.code, 'UNAUTHORIZED');
});

test('auth rejects bad credentials and invalid refresh token', async () => {
  const app = createAuthApp();
  await request(app).post('/api/auth/register').send({ email: 'bad@example.com', password: 'secret123' }).expect(201);

  const badLogin = await request(app).post('/api/auth/login').send({ email: 'bad@example.com', password: 'wrong-password' }).expect(401);
  assert.equal(badLogin.body.error.code, 'INVALID_CREDENTIALS');
  const missingUser = await request(app).post('/api/auth/login').send({ email: 'missing@example.com', password: 'wrong-password' }).expect(401);
  assert.equal(missingUser.body.error.message, badLogin.body.error.message);

  const invalidRefresh = await request(app).post('/api/auth/refresh').set('Cookie', 'refreshToken=bogus').expect(401);
  assert.equal(invalidRefresh.body.error.code, 'INVALID_REFRESH_TOKEN');
});

test('refresh cookie extends the session and logout revokes it', async () => {
  const app = createAuthApp();
  const client = request.agent(app);
  await client.post('/api/auth/register').send({ email: 'session@example.com', password: 'secret123' }).expect(201);
  await client.post('/api/auth/login').send({ email: 'session@example.com', password: 'secret123' }).expect(200);
  const refreshed = await client.post('/api/auth/refresh').expect(200);
  assert.ok(refreshed.body.data.accessToken);
  await client.post('/api/auth/logout').expect(204);
  await client.post('/api/auth/refresh').expect(401);
});

test('technician can change status only on an assigned request', async () => {
  const app = createAuthApp();
  authService.createManagedUser({ email: 'assigned-tech@example.com', password: 'secret123', role: 'technician', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  authService.createManagedUser({ email: 'other-tech@example.com', password: 'secret123', role: 'technician', id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
  const assignedLogin = await request(app).post('/api/auth/login').send({ email: 'assigned-tech@example.com', password: 'secret123' }).expect(200);
  const otherLogin = await request(app).post('/api/auth/login').send({ email: 'other-tech@example.com', password: 'secret123' }).expect(200);
  const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  await request(app).patch(`/api/requests/${requestId}/status`)
    .set('Authorization', `Bearer ${assignedLogin.body.data.accessToken}`)
    .send({ status: 'in_progress' }).expect(200);
  const denied = await request(app).patch(`/api/requests/${requestId}/status`)
    .set('Authorization', `Bearer ${otherLogin.body.data.accessToken}`)
    .send({ status: 'in_progress' }).expect(403);
  assert.equal(denied.body.error.code, 'FORBIDDEN');
});

process.on('exit', () => {
  if (originalAuthRequired === undefined) delete process.env.AUTH_REQUIRED;
  else process.env.AUTH_REQUIRED = originalAuthRequired;
});
