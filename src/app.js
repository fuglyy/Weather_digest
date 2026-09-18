import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { errorHandler, notFoundHandler, requestId, requestLogger } from './middleware/http.js';
import { createApiRouter } from './routes/api.js';

export function createApp(services = {}) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], optionsSuccessStatus: 204 }));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestId);
  app.use(requestLogger);
  app.use('/api', rateLimit({ windowMs: config.rateLimitWindowMs, limit: config.rateLimitMax, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api', createApiRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();