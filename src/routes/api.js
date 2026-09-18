import express from 'express';

import { getForecast } from '../api/openMeteoClient.js';
import { config } from '../config.js';
import { ExternalServiceError, ValidationError } from '../errors/index.js';
import { asyncHandler } from '../middleware/http.js';
import { isUuid, listQuery, validateRequest } from '../middleware/validate.js';
import { equipmentService } from '../services/equipmentService.js';
import { requestService } from '../services/requestService.js';

const send = (res, data, status = 200) => res.status(status).json({ data });
const idValidation = (req) => isUuid(req.params.id) ? [] : [{ field: 'id', message: 'Ожидается UUID' }];

export function createApiRouter(services = {}) {
  const router = express.Router();
  const equipment = services.equipmentService || equipmentService;
  const requests = services.requestService || requestService;
  const weatherClient = services.weatherClient || getForecast;

  router.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));

  router.get('/equipment', validateRequest(listQuery), asyncHandler(async (req, res) => send(res, await equipment.list(req.query))));
  router.post('/equipment', asyncHandler(async (req, res) => {
  const item = await equipment.create(req.body || {});
  res.location(`/api/equipment/${item.id}`);
  return send(res, item, 201);
  }));
  router.get('/equipment/:id', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await equipment.get(req.params.id))));
  router.patch('/equipment/:id', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await equipment.update(req.params.id, req.body || {}))));
  router.delete('/equipment/:id', validateRequest(idValidation), asyncHandler(async (req, res) => { await equipment.remove(req.params.id); res.status(204).send(); }));
  router.get('/equipment/:id/requests', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await equipment.requests(req.params.id, requests))));
  router.get('/equipment/:id/weather', validateRequest(idValidation), asyncHandler(async (req, res, next) => {
  try {
    const item = await equipment.get(req.params.id);
    const forecast = await weatherClient(item.location.lat, item.location.lon, 3);
    const days = (forecast.daily?.time || []).map((date, index) => ({ date, precipitation: forecast.daily.precipitation_sum?.[index] ?? 0, windSpeed: forecast.daily.wind_speed_10m_max?.[index] ?? null, suitable: (forecast.daily.precipitation_sum?.[index] ?? 0) === 0 && (forecast.daily.wind_speed_10m_max?.[index] ?? 0) < config.outdoorWindMax }));
    return send(res, { equipmentId: item.id, location: item.location, days, windLimit: config.outdoorWindMax });
  } catch (error) { return next(new ExternalServiceError(error.message)); }
  }));

  router.get('/requests', validateRequest((req) => listQuery(req)), asyncHandler(async (req, res) => send(res, await requests.list(req.query))));
  router.post('/requests', asyncHandler(async (req, res) => {
  const item = await requests.create(req.body || {});
  res.location(`/api/requests/${item.id}`);
  return send(res, item, 201);
  }));
  router.get('/requests/:id', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await requests.get(req.params.id))));
  router.patch('/requests/:id', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await requests.update(req.params.id, req.body || {}))));
  router.patch('/requests/:id/status', validateRequest(idValidation), asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body.status !== 'string') throw new ValidationError([{ field: 'status', message: 'Поле обязательно' }]);
  return send(res, await requests.changeStatus(req.params.id, req.body.status));
  }));
  router.delete('/requests/:id', validateRequest(idValidation), asyncHandler(async (req, res) => { await requests.remove(req.params.id); res.status(204).send(); }));

  return router;
}

export default createApiRouter();