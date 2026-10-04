import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import request from 'supertest';

const originalTrustProxy = process.env.TRUST_PROXY;

test('trust proxy is safe behind a single reverse proxy', async () => {
  process.env.TRUST_PROXY = 'true';

  const { config } = await import(`../src/config.js?ts=${Date.now()}`);
  const { createApp } = await import(`../src/app.js?ts=${Date.now() + 1}`);

  assert.equal(config.trustProxy, 1);

  const app = createApp({
    equipmentService: {
      list: async () => ({ data: [], meta: { total: 0, page: 1, limit: 10 } }),
    },
    requestService: {
      list: async () => ({ data: [], meta: { total: 0, page: 1, limit: 10 } }),
    },
    databaseHealthCheck: async () => {},
  });

  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.data.status, 'ok');

  if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = originalTrustProxy;
});
