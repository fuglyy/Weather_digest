import { config } from '../config.js';

function buildRequestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function requestJson(url, timeoutMs = config.requestTimeout, extraOptions = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
      ...extraOptions,
    });

    if (response.status >= 400 && response.status < 500) {
      throw buildRequestError(response.status, `API request failed with status ${response.status}.`);
    }

    if (response.status >= 500) {
      throw buildRequestError(response.status, `API server error: ${response.status}.`);
    }

    const text = await response.text();

    if (!text) {
      throw new Error('API returned an empty response body.');
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('API returned invalid JSON.');
    }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs} ms.`);
    }

    if (error && error instanceof TypeError) {
      throw new Error('Network error: the API is unavailable or internet access is not working.');
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function geocodeCity(city, timeoutMs = config.requestTimeout) {
  const url = new URL(config.geocodingBaseUrl);
  url.searchParams.set('name', city);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'ru');
  url.searchParams.set('format', 'json');

  return requestJson(url.toString(), timeoutMs);
}

export async function getForecast(latitude, longitude, days, timeoutMs = config.requestTimeout) {
  const url = new URL(config.forecastBaseUrl);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max');
  url.searchParams.set('forecast_days', String(days));
  url.searchParams.set('timezone', 'auto');

  return requestJson(url.toString(), timeoutMs);
}
