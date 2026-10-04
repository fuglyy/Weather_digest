import { randomUUID } from 'node:crypto';

import { config } from '../config.js';
import { AppError } from '../errors/index.js';

const durationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };

function metricsStore() {
  if (!globalThis.__appMetrics) {
    globalThis.__appMetrics = {
      requestsTotal: new Map(),
      errorsTotal: 0,
      durations: { count: 0, sum: 0, buckets: new Array(durationBuckets.length).fill(0) },
    };
  }
  return globalThis.__appMetrics;
}

function escapeLabel(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

function requestRoute(req) {
  return (req.originalUrl || '/').split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
}

export function renderPrometheusMetrics() {
  const metrics = metricsStore();
  const lines = [
    '# HELP http_requests_total Total HTTP requests processed',
    '# TYPE http_requests_total counter',
  ];
  for (const [key, count] of metrics.requestsTotal) {
    const { method, route, status } = JSON.parse(key);
    lines.push(`http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}"} ${count}`);
  }
  lines.push(
    '# HELP http_request_errors_total Total HTTP responses with status 5xx',
    '# TYPE http_request_errors_total counter',
    `http_request_errors_total ${metrics.errorsTotal}`,
    '# HELP http_request_duration_seconds HTTP request duration in seconds',
    '# TYPE http_request_duration_seconds histogram',
  );
  let cumulative = 0;
  durationBuckets.forEach((bucket, index) => {
    cumulative += metrics.durations.buckets[index];
    lines.push(`http_request_duration_seconds_bucket{le="${bucket}"} ${cumulative}`);
  });
  lines.push(
    `http_request_duration_seconds_bucket{le="+Inf"} ${metrics.durations.count}`,
    `http_request_duration_seconds_sum ${metrics.durations.sum}`,
    `http_request_duration_seconds_count ${metrics.durations.count}`,
  );
  return `${lines.join('\n')}\n`;
}

export function requestId(req, res, next) {
  const id = req.header('x-request-id') || randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const metrics = metricsStore();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const durationMs = durationSeconds * 1000;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const route = requestRoute(req);
    const counterKey = JSON.stringify({ method: req.method, route, status: res.statusCode });
    metrics.requestsTotal.set(counterKey, (metrics.requestsTotal.get(counterKey) || 0) + 1);
    if (res.statusCode >= 500) metrics.errorsTotal += 1;
    metrics.durations.count += 1;
    metrics.durations.sum += durationSeconds;
    durationBuckets.forEach((bucket, index) => {
      if (durationSeconds <= bucket) metrics.durations.buckets[index] += 1;
    });
    if ((logLevels[level] ?? 2) <= (logLevels[config.logLevel] ?? logLevels.info)) {
      console[level](JSON.stringify({ level, method: req.method, path: route, status: res.statusCode, durationMs: Math.round(durationMs), requestId: req.requestId, ip: req.ip }));
    }
  });
  next();
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Маршрут ${req.method} ${req.originalUrl} не найден`));
}

export function errorHandler(error, req, res, _next) {
  const databaseCode = error.parent?.code || error.original?.code;
  const databaseError = databaseCode === '23505'
    ? { status: 409, code: 'CONFLICT', message: 'Запись с такими данными уже существует' }
    : databaseCode === '23503'
      ? { status: 409, code: 'REFERENCE_CONFLICT', message: 'Связанная запись не найдена или используется' }
      : ['23502', '22P02', '22003'].includes(databaseCode) || error.name === 'SequelizeValidationError'
        ? { status: 422, code: 'VALIDATION_ERROR', message: 'Данные не прошли проверку' }
        : null;
  const status = error.status || databaseError?.status || 500;
  const code = error.code || databaseError?.code || 'INTERNAL_ERROR';
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Внутренняя ошибка сервера'
    : error.status ? error.message : databaseError?.message || error.message || 'Внутренняя ошибка сервера';
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.requestId, error: error.message, stack: error.stack }));
  res.status(status).json({ error: { code, message, details: error.details || [], requestId: req.requestId } });
}