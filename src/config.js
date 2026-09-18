import 'dotenv/config';

function readEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

const timeout = Number.parseInt(readEnv('REQUEST_TIMEOUT', '5000'), 10);
const rateLimitWindowMs = Number.parseInt(readEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10);
const rateLimitMax = Number.parseInt(readEnv('RATE_LIMIT_MAX', '100'), 10);

export const config = {
  port: Number.parseInt(readEnv('PORT', '3000'), 10),
  nodeEnv: readEnv('NODE_ENV', 'development'),
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
};
