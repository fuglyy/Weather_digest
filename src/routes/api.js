import express from 'express';
import swaggerUi from 'swagger-ui-express';

import { getForecast } from '../api/openMeteoClient.js';
import { config, isAuthRequired } from '../config.js';
import { AppError, ExternalServiceError, ValidationError } from '../errors/index.js';
import { asyncHandler } from '../middleware/http.js';
import { isUuid, listQuery, validateRequest } from '../middleware/validate.js';
import { sequelize } from '../db/index.js';
import { equipmentService } from '../services/equipmentService.js';
import { requestService } from '../services/requestService.js';
import { directoryService } from '../services/directoryService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { openApiDocument } from '../openapi.js';

const send = (res, data, status = 200) => res.status(status).json({ data });
const idValidation = (req) => isUuid(req.params.id) ? [] : [{ field: 'id', message: 'Ожидается UUID' }];
const siteIdValidation = (req) => typeof req.params.id === 'string' && req.params.id.trim().length > 0 ? [] : [{ field: 'id', message: 'Поле обязательно' }];

export function createApiRouter(services = {}) {
  const router = express.Router();
  const equipment = services.equipmentService || equipmentService;
  const requests = services.requestService || requestService;
  const directory = services.directoryService || directoryService;
  const weatherClient = services.weatherClient || getForecast;
  const databaseHealthCheck = services.databaseHealthCheck || (() => sequelize.authenticate());

  router.get('/health', asyncHandler(async (_req, res) => {
    if (process.env.USE_POSTGRES === 'true') {
      try {
        await databaseHealthCheck();
      } catch {
        return res.status(503).json({ data: { status: 'unavailable', database: 'disconnected' } });
      }
      return res.json({ data: { status: 'ok', database: 'connected' } });
    }
    return res.json({ data: { status: 'ok', database: 'not-configured' } });
  }));
  router.get('/health/live', asyncHandler(async (_req, res) => res.json({ data: { status: 'alive' } })));
  router.get('/health/ready', asyncHandler(async (_req, res) => {
    if (process.env.USE_POSTGRES === 'true') {
      try {
        await databaseHealthCheck();
        return res.json({ data: { status: 'ready', database: 'connected' } });
      } catch {
        return res.status(503).json({ data: { status: 'not-ready', database: 'disconnected' } });
      }
    }
    return res.json({ data: { status: 'ready', database: 'not-configured' } });
  }));
  router.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { swaggerOptions: { persistAuthorization: true } }));

  router.use(requireAuth);

  router.get('/sites', asyncHandler(async (req, res) => send(res, await directory.listSites(req.query))));
  router.post('/sites', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const site = await directory.createSite(req.body || {});
    res.location(`/api/sites/${site.id}`);
    return send(res, site, 201);
  }));
  router.get('/sites/:id', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await directory.getSite(req.params.id))));
  router.patch('/sites/:id', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await directory.updateSite(req.params.id, req.body || {}))));
  router.delete('/sites/:id', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => { await directory.removeSite(req.params.id); return res.status(204).send(); }));

  router.get('/technicians', asyncHandler(async (req, res) => send(res, await directory.listTechnicians(req.query))));
  router.post('/technicians', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const technician = await directory.createTechnician(req.body || {});
    res.location(`/api/technicians/${technician.id}`);
    return send(res, technician, 201);
  }));
  router.get('/technicians/:id', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await directory.getTechnician(req.params.id))));
  router.patch('/technicians/:id', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await directory.updateTechnician(req.params.id, req.body || {}))));
  router.delete('/technicians/:id', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => { await directory.removeTechnician(req.params.id); return res.status(204).send(); }));

  router.get('/equipment', validateRequest(listQuery), asyncHandler(async (req, res) => send(res, await equipment.list(req.query))));
  router.post('/equipment', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const item = await equipment.create(req.body || {});
    res.location(`/api/equipment/${item.id}`);
    return send(res, item, 201);
  }));
  router.get('/equipment/:id', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await equipment.get(req.params.id))));
  router.patch('/equipment/:id', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await equipment.update(req.params.id, req.body || {}))));
  router.delete('/equipment/:id', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => { await equipment.remove(req.params.id); res.status(204).send(); }));
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
  router.post('/requests', requireAuth, requireRole('technician', 'admin'), asyncHandler(async (req, res) => {
    const item = await requests.create(req.body || {});
    res.location(`/api/requests/${item.id}`);
    return send(res, item, 201);
  }));
  router.get('/requests/:id', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await requests.get(req.params.id))));
  router.patch('/requests/:id', requireAuth, requireRole('technician', 'admin'), validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await requests.update(req.params.id, req.body || {}))));
  router.patch('/requests/:id/status', requireAuth, requireRole('technician', 'admin'), validateRequest(idValidation), asyncHandler(async (req, res) => {
    if (!req.body || typeof req.body.status !== 'string') throw new ValidationError([{ field: 'status', message: 'Поле обязательно' }]);
    if (isAuthRequired() && req.user && req.user.role !== 'admin') {
      const record = await requests.get(req.params.id);
      const assignedUserIds = (record.assignedTechnicians || []).map((entry) => String(entry.userId ?? entry.technicianId ?? entry.id));
      if (!assignedUserIds.includes(String(req.user.id))) {
        throw new AppError(403, 'FORBIDDEN', 'Запрос доступен только назначенным специалистам');
      }
    }
    return send(res, await requests.changeStatus(req.params.id, req.body.status));
  }));
  router.post('/requests/:id/assignees', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => {
    const payload = Array.isArray(req.body) ? req.body : (req.body?.assignees || []);
    return send(res, await requests.assignTechnicians(req.params.id, payload), 201);
  }));
  router.delete('/requests/:id/assignees/:userId', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => {
    await requests.removeAssignee(req.params.id, req.params.userId);
    return res.status(204).send();
  }));
  router.get('/requests/:id/history', validateRequest(idValidation), asyncHandler(async (req, res) => send(res, await requests.history(req.params.id))));
  router.get('/sites/:id/summary', validateRequest(siteIdValidation), asyncHandler(async (req, res) => send(res, await requests.siteSummary(req.params.id))));
  router.get('/reports/equipment-load', validateRequest((req) => {
    const errors = [];
    if (req.query.period && !['all', 'week', 'month', 'quarter'].includes(req.query.period)) errors.push({ field: 'period', message: 'Допустимые значения: all, week, month, quarter' });
    if (req.query.minRequests !== undefined && (!Number.isInteger(Number(req.query.minRequests)) || Number(req.query.minRequests) < 0)) errors.push({ field: 'minRequests', message: 'Ожидается неотрицательное целое число' });
    if (req.query.siteId && !isUuid(req.query.siteId)) errors.push({ field: 'siteId', message: 'Ожидается UUID' });
    return errors;
  }), asyncHandler(async (req, res) => send(res, await requests.equipmentLoad(req.query))));
  router.delete('/requests/:id', requireAuth, requireRole('admin'), validateRequest(idValidation), asyncHandler(async (req, res) => { await requests.remove(req.params.id); res.status(204).send(); }));

  return router;
}

export default createApiRouter();