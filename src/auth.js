import crypto from 'node:crypto';

import { config } from './config.js';

const base64url = (value) => globalThis.Buffer.from(value).toString('base64url');
const fromBase64url = (value) => globalThis.Buffer.from(value, 'base64url');

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const { hash: candidateHash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(globalThis.Buffer.from(candidateHash, 'hex'), globalThis.Buffer.from(hash, 'hex'));
}

export function signToken(payload, expiresInSeconds) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  const secret = config.jwtSecret;
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerBase64, payloadBase64, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', config.jwtSecret).update(`${headerBase64}.${payloadBase64}`).digest('base64url');
  const signatureBuffer = globalThis.Buffer.from(signature);
  const expectedBuffer = globalThis.Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(fromBase64url(payloadBase64).toString('utf8'));
    if (typeof payload.exp !== 'number') return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
