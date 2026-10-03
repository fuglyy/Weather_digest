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