import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { QueryTypes } from 'sequelize';

import { config } from './config.js';
import { asyncHandler, errorHandler, notFoundHandler, renderPrometheusMetrics, requestId, requestLogger } from './middleware/http.js';
import { createApiRouter } from './routes/api.js';
import { createAuthRouter } from './routes/auth.js';
import { sequelize } from './db/index.js';

function metricLabel(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

async function renderMaintenanceMetrics() {
  if (process.env.USE_POSTGRES !== 'true') return '';
  const [statuses, priorities, closure, equipment, overdue] = await Promise.all([
    sequelize.query('SELECT status, COUNT(*)::bigint AS total FROM maintenance_requests GROUP BY status', { type: QueryTypes.SELECT }),
    sequelize.query('SELECT priority, COUNT(*)::bigint AS total FROM maintenance_requests GROUP BY priority', { type: QueryTypes.SELECT }),
    sequelize.query("SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 0) AS seconds FROM maintenance_requests WHERE status = 'done'", { type: QueryTypes.SELECT }),
    sequelize.query('SELECT equipment_id, COUNT(*)::bigint AS total FROM maintenance_requests GROUP BY equipment_id', { type: QueryTypes.SELECT }),
    sequelize.query("SELECT COUNT(*)::bigint AS total FROM maintenance_requests WHERE planned_at < NOW() AND status NOT IN ('done', 'rejected')", { type: QueryTypes.SELECT }),
  ]);
  const lines = [
    '# HELP maintenance_requests Number of maintenance requests by state',
    '# TYPE maintenance_requests gauge',
    ...statuses.map((row) => `maintenance_requests{status="${metricLabel(row.status)}"} ${row.total}`),
    ...priorities.map((row) => `maintenance_requests{priority="${metricLabel(row.priority)}"} ${row.total}`),
    '# HELP maintenance_average_closure_seconds Mean duration of completed requests',
    '# TYPE maintenance_average_closure_seconds gauge',
    `maintenance_average_closure_seconds ${Number(closure[0]?.seconds || 0)}`,
    '# HELP maintenance_equipment_requests Number of requests per equipment item',
    '# TYPE maintenance_equipment_requests gauge',
    ...equipment.map((row) => `maintenance_equipment_requests{equipment_id="${metricLabel(row.equipment_id)}"} ${row.total}`),
    '# HELP maintenance_overdue_planned_work Number of overdue open planned requests',
    '# TYPE maintenance_overdue_planned_work gauge',
    `maintenance_overdue_planned_work ${overdue[0]?.total || 0}`,
  ];
  return `${lines.join('\n')}\n`;
}

export function createApp(services = {}) {
  const app = express();
  const maintenanceMetrics = services.maintenanceMetrics || renderMaintenanceMetrics;
  app.set('trust proxy', config.trustProxy);
  const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Слишком много попыток входа' } },
  });

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], optionsSuccessStatus: 204 }));
  app.use(express.json({ limit: '100kb' }));
  app.use((req, _res, next) => {
    const cookieHeader = req.headers.cookie || '';
    req.cookies = Object.fromEntries(cookieHeader.split(';').map((entry) => {
      const [name, ...rest] = entry.trim().split('=');
      return name ? [name, decodeURIComponent(rest.join('='))] : [];
    }).filter(([name]) => Boolean(name)));
    next();
  });
  app.use(requestId);
  app.use(requestLogger);
  app.use('/api', rateLimit({ windowMs: config.rateLimitWindowMs, limit: config.rateLimitMax, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/auth/login', authLoginLimiter);
  app.use('/api/auth', createAuthRouter());
  app.use('/api', createApiRouter(services));
  app.post('/internal/alerts', (req, res) => {
    if (!config.alertWebhookToken || req.get('authorization') !== `Bearer ${config.alertWebhookToken}`) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized alert receiver' } });
    }
    console.warn(JSON.stringify({ level: 'warn', event: 'prometheus_alert', alerts: req.body?.alerts || [] }));
    return res.status(202).send();
  });
  app.get('/metrics', asyncHandler(async (_req, res) => {
    const body = `${renderPrometheusMetrics()}${await maintenanceMetrics()}`;
    return res.type('text/plain; version=0.0.4').send(body);
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();