import express from 'express';

import { AppError } from '../errors/index.js';
import { asyncHandler } from '../middleware/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { authService } from '../services/authService.js';
import { config } from '../config.js';
import { Technician } from '../db/models/index.js';
import { isUuid } from '../middleware/validate.js';

const setRefreshCookie = (res, value) => {
  res.cookie('refreshToken', value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
};

export function createAuthRouter() {
  const router = express.Router();

  router.post('/register', asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = authService.register({ email, password });
    return res.status(201).json({ data: { user } });
  }));

  router.post('/users', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const { email, password, role, technicianId } = req.body || {};
    if (role === 'technician') {
      if (!isUuid(technicianId)) throw new AppError(422, 'VALIDATION_ERROR', 'Ожидается UUID специалиста');
      const technician = await Technician.findByPk(technicianId);
      if (!technician) throw new AppError(404, 'NOT_FOUND', 'Специалист не найден');
    }
    const user = authService.createManagedUser({ email, password, role, id: role === 'technician' ? technicianId : undefined });
    return res.status(201).json({ data: { user } });
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const result = authService.login({ email, password });
    setRefreshCookie(res, result.refreshToken);
    return res.json({ data: { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn } });
  }));

  router.post('/refresh', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
    if (!refreshToken) throw new AppError(401, 'UNAUTHORIZED', 'Refresh token отсутствует');
    const result = authService.refresh(refreshToken);
    setRefreshCookie(res, refreshToken);
    return res.json({ data: { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user } });
  }));

  router.post('/logout', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
    authService.logout(refreshToken);
    res.clearCookie('refreshToken', { path: '/' });
    return res.status(204).send();
  }));

  router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    return res.json({ data: { user: req.user } });
  }));

  return router;
}

export default createAuthRouter();
