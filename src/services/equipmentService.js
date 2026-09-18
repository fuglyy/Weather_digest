import { randomUUID } from 'node:crypto';

import { ConflictError, NotFoundError, ValidationError } from '../errors/index.js';
import { requestRepository } from '../repositories/fileRepository.js';

const types = ['turbine', 'inverter', 'sensor', 'substation'];
const statuses = ['operational', 'maintenance', 'fault', 'decommissioned'];

function validatePayload(payload, partial = false) {
  const details = [];
  const required = ['name', 'type', 'serialNumber', 'location', 'status', 'installedAt'];
  if (!partial) for (const field of required) if (payload[field] === undefined) details.push({ field, message: 'Поле обязательно' });
  if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.trim().length < 3 || payload.name.trim().length > 100)) details.push({ field: 'name', message: 'От 3 до 100 символов' });
  if (payload.type !== undefined && !types.includes(payload.type)) details.push({ field: 'type', message: 'Недопустимый тип' });
  if (payload.serialNumber !== undefined && (typeof payload.serialNumber !== 'string' || !payload.serialNumber.trim())) details.push({ field: 'serialNumber', message: 'Обязательная строка' });
  if (payload.status !== undefined && !statuses.includes(payload.status)) details.push({ field: 'status', message: 'Недопустимый статус' });
  if (payload.location !== undefined && (!payload.location || typeof payload.location.lat !== 'number' || typeof payload.location.lon !== 'number' || payload.location.lat < -90 || payload.location.lat > 90 || payload.location.lon < -180 || payload.location.lon > 180)) details.push({ field: 'location', message: 'Некорректные координаты' });
  if (payload.installedAt !== undefined && (Number.isNaN(Date.parse(payload.installedAt)) || new Date(payload.installedAt) > new Date())) details.push({ field: 'installedAt', message: 'Дата должна быть ISO и не быть в будущем' });
  return details;
}

function cleanPayload(payload) {
  return Object.fromEntries(['name', 'type', 'serialNumber', 'location', 'status', 'installedAt'].filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
}

function paginate(records, query) {
  const filtered = records.filter((record) => (!query.type || record.type === query.type) && (!query.status || record.status === query.status));
  const sorted = [...filtered].sort((a, b) => String(a[query.sortBy || 'name']).localeCompare(String(b[query.sortBy || 'name'])) * (query.order === 'desc' ? -1 : 1));
  const page = Number(query.page || 1); const limit = Number(query.limit || 20);
  return { data: sorted.slice((page - 1) * limit, page * limit), meta: { total: sorted.length, page, limit } };
}

export function createEquipmentService(equipmentRepository) {
  return {
    async list(query) { return paginate(await equipmentRepository.findAll(), query); },
    async get(id) { const item = await equipmentRepository.findById(id); if (!item) throw new NotFoundError('Оборудование не найдено'); return item; },
    async create(payload) {
      const details = validatePayload(payload); if (details.length) throw new ValidationError(details);
      if ((await equipmentRepository.findAll()).some((item) => item.serialNumber === payload.serialNumber)) throw new ConflictError('Серийный номер уже используется');
      return equipmentRepository.create({ id: randomUUID(), ...cleanPayload(payload) });
    },
    async update(id, payload) {
      await this.get(id); const details = validatePayload(payload, true); if (details.length) throw new ValidationError(details);
      if (payload.serialNumber && (await equipmentRepository.findAll()).some((item) => item.serialNumber === payload.serialNumber && item.id !== id)) throw new ConflictError('Серийный номер уже используется');
      return equipmentRepository.update(id, cleanPayload(payload));
    },
    async remove(id) {
      await this.get(id); const requests = await requestRepository.findAll();
      if (requests.some((request) => request.equipmentId === id && !['done', 'rejected'].includes(request.status))) throw new ConflictError('Нельзя удалить оборудование с открытыми заявками');
      await equipmentRepository.remove(id);
    },
    async requests(id, requestService) { await this.get(id); return requestService.list({ equipmentId: id }); },
  };
}

export const equipmentService = createEquipmentService((await import('../repositories/fileRepository.js')).equipmentRepository);