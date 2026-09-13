import { geocodeCity, getForecast } from '../api/openMeteoClient.js';
import { readCachedReport, saveReport } from '../storage/reportStore.js';

export function normalizeForecastData(response, days) {
  const daily = response?.daily;

  if (!daily || !Array.isArray(daily.time)) {
    throw new Error('API response does not contain forecast data.');
  }

  const expectedLength = Number.isFinite(days) ? days : daily.time.length;
  const result = [];

  for (let index = 0; index < Math.min(expectedLength, daily.time.length); index += 1) {
    const date = daily.time[index];
    const minTemp = daily.temperature_2m_min?.[index];
    const maxTemp = daily.temperature_2m_max?.[index];
    const precipitation = daily.precipitation_sum?.[index];

    if (typeof date !== 'string' || typeof minTemp !== 'number' || typeof maxTemp !== 'number' || typeof precipitation !== 'number') {
      throw new Error('Forecast payload is malformed.');
    }

    result.push({
      date,
      minTemp,
      maxTemp,
      precipitation,
    });
  }

  return result;
}

export async function getCityWeather(city, days, options = {}) {
  const { noCache = false } = options;
  const cached = noCache ? null : await readCachedReport(city);

  if (cached) {
    return cached;
  }

  const geocodeData = await geocodeCity(city);

  if (!Array.isArray(geocodeData?.results) || geocodeData.results.length === 0) {
    throw new Error(`City "${city}" was not found.`);
  }

  const location = geocodeData.results[0];
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`Coordinates for city "${city}" are invalid.`);
  }

  const forecastData = await getForecast(latitude, longitude, days);
  const normalized = normalizeForecastData(forecastData, days);

  const report = {
    city: location.name,
    country: location.country,
    latitude,
    longitude,
    days: normalized,
    generatedAt: new Date().toISOString(),
  };

  await saveReport(city, report);
  return report;
}
