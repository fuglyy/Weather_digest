import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { AppError } from '../errors/index.js';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../auth.js';
import { config } from '../config.js';

const users = new Map();
const refreshTokens = new Map();
const dummyPassword = hashPassword('invalid-password', 'auth-dummy-salt');

function refreshTokenKey(token) {
  return createHash('sha256').update(token).digest('hex');
}

function authStorePath() {
  return config.nodeEnv === 'production' ? path.resolve(config.dataDir, 'auth-state.json') : null;
}

function loadAuthState() {
  const filename = authStorePath();
  if (!filename) return;
  try {
    const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
    for (const user of saved.users || []) users.set(user.email, user);
    for (const [tokenHash, userId] of saved.refreshTokens || []) refreshTokens.set(tokenHash, userId);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function saveAuthState() {
  const filename = authStorePath();
  if (!filename) return;
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporaryFilename = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFilename, JSON.stringify({
    users: [...users.values()],
    refreshTokens: [...refreshTokens.entries()],
  }), { mode: 0o600 });
  fs.renameSync(temporaryFilename, filename);
}

loadAuthState();

function sanitizeUser(user) {
  if (!user) return null;
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  delete safeUser.passwordSalt;
  return safeUser;
}

export function listUsers() {
  return [...users.values()].map((user) => sanitizeUser(user));
}

function createUser(email, password, role, id = randomUUID()) {
  const trimmedEmail = String(email || '').trim().toLowerCase();
  if (!trimmedEmail || String(password || '').trim().length < 8) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Email обязателен, пароль должен содержать не менее 8 символов');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Некорректный email');
  }
  if (users.has(trimmedEmail)) {
    throw new AppError(409, 'CONFLICT', 'Пользователь уже существует');
  }
  if ([...users.values()].some((entry) => entry.id === id)) {
    throw new AppError(409, 'CONFLICT', 'Идентификатор пользователя уже используется');
  }

  const { hash, salt } = hashPassword(String(password));
  const now = new Date().toISOString();
  const user = {
    id,
    email: trimmedEmail,
    role,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: now,
    updatedAt: now,
  };
  users.set(trimmedEmail, user);
  saveAuthState();
  return sanitizeUser(user);
}

export const authService = {
  register: ({ email, password }) => {
    return createUser(email, password, 'viewer');
  },

  bootstrapAdmin: ({ email, password }) => {
    if (users.size || !email || !password) return false;
    createUser(email, password, 'admin');
    return true;
  },

  createManagedUser: ({ email, password, role, id }) => {
    if (!['technician', 'admin'].includes(role)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Допустимы только роли technician и admin');
    }
    if (role === 'technician' && !id) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Для специалиста обязателен technicianId');
    }
    return createUser(email, password, role, id || randomUUID());
  },

  login: ({ email, password }) => {
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const user = users.get(trimmedEmail);
    const passwordMatches = verifyPassword(
      String(password || ''),
      user?.passwordHash || dummyPassword.hash,
      user?.passwordSalt || dummyPassword.salt,
    );
    if (!user || !passwordMatches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль');
    }

    const accessToken = signToken({ sub: user.id, email: user.email, role: user.role, type: 'access' }, config.jwtAccessTtl);
    const refreshToken = signToken({ sub: user.id, email: user.email, role: user.role, type: 'refresh' }, config.jwtRefreshTtl);
    refreshTokens.set(refreshTokenKey(refreshToken), user.id);
    saveAuthState();

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
      expiresIn: config.jwtAccessTtl,
    };
  },

  refresh: (refreshTokenValue) => {
    const payload = verifyToken(refreshTokenValue);
    if (!payload || payload.type !== 'refresh') {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Сессия недействительна');
    }
    const tokenKey = refreshTokenKey(refreshTokenValue);
    const userId = refreshTokens.get(tokenKey);
    if (!userId) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Сессия недействительна');
    }

    const user = [...users.values()].find((entry) => entry.id === userId);
    if (!user) {
      refreshTokens.delete(tokenKey);
      saveAuthState();
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Пользователь не найден');
    }

    const accessToken = signToken({ sub: user.id, email: user.email, role: user.role, type: 'access' }, config.jwtAccessTtl);
    return {
      accessToken,
      expiresIn: config.jwtAccessTtl,
      user: sanitizeUser(user),
    };
  },

  logout: (refreshTokenValue) => {
    if (refreshTokenValue) {
      refreshTokens.delete(refreshTokenKey(refreshTokenValue));
      saveAuthState();
    }
    return { ok: true };
  },

  getUserById: (userId) => {
    const user = [...users.values()].find((entry) => entry.id === userId);
    return user ? sanitizeUser(user) : null;
  },

  getUserByAccessToken: (token) => {
    const payload = verifyToken(token);
    if (!payload || payload.type !== 'access') return null;
    return authService.getUserById(payload.sub);
  },
};
