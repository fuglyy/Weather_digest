import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from '../config.js';

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getReportFilename(city) {
  const base = String(city).trim();

  const transliterated = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\p{Diacritic}]/gu, '')
    .toLowerCase();

  const safeCity = transliterated
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'city';

  return `${safeCity}-${formatDate(new Date())}.json`;
}

export async function ensureReportsDirectory() {
  await fs.mkdir(path.resolve(process.cwd(), config.reportsDir), { recursive: true });
}

export async function readCachedReport(city) {
  const reportPath = path.resolve(process.cwd(), config.reportsDir, getReportFilename(city));

  try {
    const content = await fs.readFile(reportPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function saveReport(city, payload) {
  await ensureReportsDirectory();
  const reportPath = path.resolve(process.cwd(), config.reportsDir, getReportFilename(city));
  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf8');
  return reportPath;
}
