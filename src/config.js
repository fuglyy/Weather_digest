import 'dotenv/config';

function readEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

const timeout = Number.parseInt(readEnv('REQUEST_TIMEOUT', '5000'), 10);
const rateLimitWindowMs = Number.parseInt(readEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10);
const rateLimitMax = Number.parseInt(readEnv('RATE_LIMIT_MAX', '100'), 10);

const jwtSecret = readEnv('JWT_SECRET', 'development-secret-change-me');
const jwtAccessTtl = Number.parseInt(readEnv('JWT_ACCESS_TTL', '900'), 10);
const jwtRefreshTtl = Number.parseInt(readEnv('JWT_REFRESH_TTL', '604800'), 10);
const authRequired = readEnv('AUTH_REQUIRED', 'false').toLowerCase() === 'true';
const trustProxyRaw = readEnv('TRUST_PROXY', 'false');
const trustProxy = (() => {
  const value = trustProxyRaw.toLowerCase();
  if (value === 'true' || value === '1') return 1;
  if (value === 'false' || value === '0' || value === '') return false;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : false;
})();

export const config = {
  port: Number.parseInt(readEnv('PORT', '3000'), 10),
  nodeEnv: readEnv('NODE_ENV', 'development'),
  logLevel: readEnv('LOG_LEVEL', 'info').toLowerCase(),
  corsOrigins: readEnv('CORS_ORIGINS', 'http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean),
  rateLimitWindowMs: Number.isFinite(rateLimitWindowMs) ? rateLimitWindowMs : 900000,
  rateLimitMax: Number.isFinite(rateLimitMax) ? rateLimitMax : 100,
  geocodingBaseUrl: readEnv('GEOCODING_BASE_URL', 'https://geocoding-api.open-meteo.com/v1/search'),
  forecastBaseUrl: readEnv('FORECAST_BASE_URL', 'https://api.open-meteo.com/v1/forecast'),
  weatherApiUrl: readEnv('WEATHER_API_URL', readEnv('FORECAST_BASE_URL', 'https://api.open-meteo.com/v1/forecast')),
  requestTimeout: Number.isFinite(timeout) ? timeout : 5000,
  requestTimeoutMs: Number.isFinite(timeout) ? timeout : 5000,
  outdoorWindMax: Number.parseFloat(readEnv('OUTDOOR_WIND_MAX', '10')),
  dataDir: readEnv('DATA_DIR', 'data'),
  reportsDir: readEnv('REPORTS_DIR', 'reports'),
  jwtSecret,
  jwtAccessTtl: Number.isFinite(jwtAccessTtl) ? jwtAccessTtl : 900,
  jwtRefreshTtl: Number.isFinite(jwtRefreshTtl) ? jwtRefreshTtl : 604800,
  authRequired,
  trustProxy,
  alertWebhookToken: readEnv('ALERT_WEBHOOK_TOKEN', ''),
};

export function isAuthRequired() {
  const raw = process.env.AUTH_REQUIRED ?? String(config.authRequired);
  return raw.toLowerCase() === 'true';
}
