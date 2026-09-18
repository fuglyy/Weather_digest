import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from '../config.js';

export function createFileRepository(filename) {
  const filePath = path.resolve(process.cwd(), config.dataDir, filename);

  async function readAll() {
    try {
      const records = JSON.parse(await fs.readFile(filePath, 'utf8'));
      return Array.isArray(records) ? records : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async function writeAll(records) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf8');
  }

  return {
    findAll: readAll,
    async findById(id) { return (await readAll()).find((record) => record.id === id) || null; },
    async create(record) { const records = await readAll(); records.push(record); await writeAll(records); return record; },
    async update(id, changes) {
      const records = await readAll();
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) return null;
      records[index] = { ...records[index], ...changes };
      await writeAll(records);
      return records[index];
    },
    async remove(id) {
      const records = await readAll();
      const remaining = records.filter((record) => record.id !== id);
      if (remaining.length === records.length) return false;
      await writeAll(remaining);
      return true;
    },
  };
}

export const equipmentRepository = createFileRepository('equipment.json');
export const requestRepository = createFileRepository('requests.json');