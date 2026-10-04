import { isAuthRequired } from '../config.js';
import { AppError } from '../errors/index.js';
import { verifyToken } from '../auth.js';

export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

export function getRequestUser(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) return null;
  const payload = verifyToken(accessToken);
  if (!payload || payload.type !== 'access') return null;
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}

export function requireAuth(req, res, next) {
  if (!isAuthRequired()) {
    req.user = null;
    return next();
  }

  const user = getRequestUser(req);
  if (!user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Требуется аутентификация'));
  }

  req.user = user;
  return next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!isAuthRequired()) {
      req.user = req.user || null;
      return next();
    }

    const user = req.user;
    if (!user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Требуется аутентификация'));
    }
    if (!allowedRoles.includes(user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Недостаточно прав'));
    }
    return next();
  };
}
