import { randomUUID } from 'node:crypto';

import { ConflictError, NotFoundError, ValidationError } from '../errors/index.js';
import { equipmentRepository } from '../repositories/fileRepository.js';

const priorities = ['low', 'medium', 'high', 'critical'];
const statuses = ['new', 'in_progress', 'done', 'rejected'];
const transitions = { new: ['in_progress', 'rejected'], in_progress: ['done', 'rejected'], done: [], rejected: [] };

function validate(payload, partial = false) {
  const details = []; const required = ['equipmentId', 'title', 'priority'];
  if (!partial) for (const field of required) if (payload[field] === undefined) details.push({ field, message: 'Поле обязательно' });
  if (payload.title !== undefined && (typeof payload.title !== 'string' || payload.title.trim().length < 5 || payload.title.trim().length > 120)) details.push({ field: 'title', message: 'От 5 до 120 символов' });
  if (payload.description !== undefined && (typeof payload.description !== 'string' || payload.description.length > 2000)) details.push({ field: 'description', message: 'Не более 2000 символов' });
  if (payload.priority !== undefined && !priorities.includes(payload.priority)) details.push({ field: 'priority', message: 'Недопустимый приоритет' });
  if (payload.plannedAt !== undefined && Number.isNaN(Date.parse(payload.plannedAt))) details.push({ field: 'plannedAt', message: 'Ожидается ISO-дата' });
  return details;
}

function clean(payload) { return Object.fromEntries(['equipmentId', 'title', 'description', 'priority', 'plannedAt'].filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]])); }

export function createRequestService(requestRepository, equipmentRepo = equipmentRepository) {
  return {
    async list(query = {}) {
      let records = await requestRepository.findAll();
      if (query.equipmentId) records = records.filter((record) => record.equipmentId === query.equipmentId);
      if (query.status) records = records.filter((record) => record.status === query.status);
      if (query.priority) records = records.filter((record) => record.priority === query.priority);
      const page = Number(query.page || 1); const limit = Number(query.limit || 20);
      records.sort((a, b) => new Date(a[query.sortBy || 'createdAt']) - new Date(b[query.sortBy || 'createdAt']));
      if (query.order === 'desc') records.reverse();
      return { data: records.slice((page - 1) * limit, page * limit), meta: { total: records.length, page, limit } };
    },
    async get(id) { const item = await requestRepository.findById(id); if (!item) throw new NotFoundError('Заявка не найдена'); return item; },
    async create(payload) {
      const details = validate(payload); if (details.length) throw new ValidationError(details);
      if (!(await equipmentRepo.findById(payload.equipmentId))) throw new NotFoundError('Оборудование не найдено');
      const now = new Date().toISOString();
      return requestRepository.create({ id: randomUUID(), ...clean(payload), status: 'new', createdAt: now, updatedAt: now });
    },
    async update(id, payload) { await this.get(id); const details = validate(payload, true); if (details.length) throw new ValidationError(details); return requestRepository.update(id, { ...clean(payload), updatedAt: new Date().toISOString() }); },
    async changeStatus(id, status) {
      const request = await this.get(id);
      if (!statuses.includes(status)) throw new ValidationError([{ field: 'status', message: 'Недопустимый статус' }]);
      if (!transitions[request.status].includes(status)) throw new ConflictError(`Переход ${request.status} -> ${status} запрещён`);
      return requestRepository.update(id, { status, updatedAt: new Date().toISOString() });
    },
    async remove(id) { await this.get(id); await requestRepository.remove(id); },
  };
}

export const requestService = createRequestService((await import('../repositories/fileRepository.js')).requestRepository);