import { randomUUID } from 'node:crypto';

import { AppError } from '../errors/index.js';

export function requestId(req, res, next) {
  const id = req.header('x-request-id') || randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    console[level](JSON.stringify({ level, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Math.round(durationMs), requestId: req.requestId }));
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
  const status = error.status || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = status >= 500 && process.env.NODE_ENV === 'production' ? 'Внутренняя ошибка сервера' : error.message || 'Внутренняя ошибка сервера';
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.requestId, error: error.message, stack: error.stack }));
  res.status(status).json({ error: { code, message, details: error.details || [], requestId: req.requestId } });
}