import { ValidationError } from '../errors/index.js';

export function validateRequest(validate) {
  return (req, _res, next) => {
    const details = validate(req) || [];
    if (details.length > 0) return next(new ValidationError(details));
    next();
  };
}

export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function requiredString(value, field, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) return { field, message: `Строка должна содержать от ${min} до ${max} символов` };
  return null;
}

export function optionalIsoDate(value, field) {
  if (value !== undefined && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) return { field, message: 'Ожидается ISO-дата' };
  return null;
}

export function listQuery(req) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1) return [{ field: 'page', message: 'Страница должна быть положительным целым числом' }];
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return [{ field: 'limit', message: 'Лимит должен быть от 1 до 100' }];
  return [];
}