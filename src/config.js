import 'dotenv/config';

function readEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

const timeout = Number.parseInt(readEnv('REQUEST_TIMEOUT', '5000'), 10);

export const config = {
  geocodingBaseUrl: readEnv('GEOCODING_BASE_URL', 'https://geocoding-api.open-meteo.com/v1/search'),
  forecastBaseUrl: readEnv('FORECAST_BASE_URL', 'https://api.open-meteo.com/v1/forecast'),
  requestTimeout: Number.isFinite(timeout) ? timeout : 5000,
  reportsDir: readEnv('REPORTS_DIR', 'reports'),
};
