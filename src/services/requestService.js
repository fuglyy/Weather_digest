import { randomUUID } from 'node:crypto';

import { sequelize } from '../db/index.js';
import { RequestStatusHistory } from '../db/models/index.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/index.js';
import { equipmentRepository } from '../repositories/fileRepository.js';
import { createDefaultRepositories } from '../repositories/postgresRepository.js';

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

function normalizeAssignees(assignees) {
  const list = Array.isArray(assignees) ? assignees : [assignees].filter(Boolean);
  return list.map((entry) => {
    const userId = entry?.userId || entry?.technicianId || entry?.id;
    return {
      userId,
      role: entry?.role || 'member',
      hours: entry?.hours ?? 0,
    };
  });
}

function getAssignees(record) {
  if (Array.isArray(record?.assignees)) return record.assignees;
  if (Array.isArray(record?.assignedTechnicians)) return record.assignedTechnicians;
  return [];
}

function canUsePostgresTransactions() {
  return process.env.USE_POSTGRES === 'true' && sequelize?.getDialect && sequelize.getDialect() === 'postgres';
}

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
      return requestRepository.create({ id: randomUUID(), ...clean(payload), status: 'new', assignees: [], assignedTechnicians: [], createdAt: now, updatedAt: now });
    },
    async update(id, payload) { await this.get(id); const details = validate(payload, true); if (details.length) throw new ValidationError(details); return requestRepository.update(id, { ...clean(payload), updatedAt: new Date().toISOString() }); },
    async changeStatus(id, status) {
      const request = await this.get(id);
      if (!statuses.includes(status)) throw new ValidationError([{ field: 'status', message: 'Недопустимый статус' }]);
      if (!transitions[request.status].includes(status)) throw new ConflictError(`Переход ${request.status} -> ${status} запрещён`);
      if (status === 'in_progress') {
        const assignees = normalizeAssignees(getAssignees(request));
        const leadCount = assignees.filter((entry) => entry.role === 'lead').length;
        if (assignees.length === 0 || leadCount !== 1) {
          throw new ConflictError('Нельзя перевести заявку в in_progress без назначенной бригады');
        }
      }

      const updatedAt = new Date().toISOString();
      if (canUsePostgresTransactions()) {
        const t = await sequelize.transaction();
        try {
          const updated = await requestRepository.update(id, { status, updatedAt }, { transaction: t });
          await RequestStatusHistory.create({
            requestId: id,
            oldStatus: request.status,
            newStatus: status,
            changedBy: 'system',
            comment: `Статус изменён на ${status}`,
            createdAt: new Date(),
          }, { transaction: t });
          await t.commit();
          return updated;
        } catch (error) {
          await t.rollback();
          throw error;
        }
      }

      return requestRepository.update(id, { status, updatedAt });
    },
    async assignTechnicians(id, assignees) {
      const request = await this.get(id);
      const list = normalizeAssignees(assignees);
      if (!list.length) throw new ValidationError([{ field: 'assignees', message: 'Список назначений обязателен' }]);
      const seen = new Set();
      const invalid = list.some((entry) => {
        const userId = entry.userId;
        if (!userId || seen.has(userId)) return true;
        seen.add(userId);
        return !['lead', 'member'].includes(entry.role || 'member');
      });
      if (invalid) throw new ValidationError([{ field: 'assignees', message: 'Некорректный список назначений' }]);
      const leadCount = list.filter((entry) => entry.role === 'lead').length;
      if (leadCount !== 1) throw new ValidationError([{ field: 'assignees', message: 'В бригаде должен быть ровно один lead' }]);

      const updatedAt = new Date().toISOString();
      if (canUsePostgresTransactions()) {
        const t = await sequelize.transaction();
        try {
          const updated = await requestRepository.update(id, { assignees: list, assignedTechnicians: list, updatedAt }, { transaction: t });
          await t.commit();
          return { requestId: id, assignees: list, currentRequest: request, updated };
        } catch (error) {
          await t.rollback();
          throw error;
        }
      }

      const updated = await requestRepository.update(id, { assignees: list, assignedTechnicians: list, updatedAt });
      return { requestId: id, assignees: list, currentRequest: request, updated };
    },
    async removeAssignee(id, userId) {
      const request = await this.get(id);
      if (!userId) throw new ValidationError([{ field: 'userId', message: 'Поле обязательно' }]);
      const assignees = normalizeAssignees(getAssignees(request));
      const filtered = assignees.filter((entry) => String(entry.userId) !== String(userId));
      if (filtered.length === assignees.length) throw new NotFoundError('Исполнитель не найден');
      const updatedAt = new Date().toISOString();
      await requestRepository.update(id, { assignees: filtered, assignedTechnicians: filtered, updatedAt });
      return { requestId: id, removedUserId: userId };
    },
    async history(id) {
      const request = await this.get(id);
      const history = Array.isArray(request.statusHistory) ? request.statusHistory : [];
      if (history.length > 0) return history;
      return [
        {
          id: randomUUID(),
          requestId: id,
          oldStatus: 'new',
          newStatus: request.status,
          changedBy: 'system',
          comment: 'Статус обновлён',
          createdAt: new Date().toISOString(),
        },
      ];
    },
    async siteSummary(siteId) {
      if (!siteId) throw new ValidationError([{ field: 'siteId', message: 'Поле обязательно' }]);
      const equipment = await equipmentRepo.findAll();
      const requests = await requestRepository.findAll();
      const siteEquipmentIds = new Set(equipment.filter((item) => item.siteId === siteId).map((item) => item.id));
      const siteRequests = requests.filter((request) => siteEquipmentIds.has(request.equipmentId));
      const byStatus = { new: 0, in_progress: 0, done: 0, rejected: 0 };
      const byPriority = { low: 0, medium: 0, high: 0, critical: 0 };
      let totalHours = 0;
      let closeCount = 0;

      for (const request of siteRequests) {
        byStatus[request.status] = (byStatus[request.status] ?? 0) + 1;
        byPriority[request.priority] = (byPriority[request.priority] ?? 0) + 1;
        if (request.createdAt && request.updatedAt && request.status === 'done') {
          const diffHours = (new Date(request.updatedAt) - new Date(request.createdAt)) / (1000 * 60 * 60);
          totalHours += Number.isFinite(diffHours) ? diffHours : 0;
          closeCount += 1;
        }
      }

      return {
        siteId,
        totalRequests: siteRequests.length,
        byStatus,
        byPriority,
        averageCloseHours: closeCount > 0 ? Number((totalHours / closeCount).toFixed(2)) : 0,
      };
    },
    async equipmentLoad(query = {}) {
      const requests = await requestRepository.findAll();
      const equipment = await equipmentRepo.findAll();
      const equipmentMap = new Map(equipment.map((item) => [item.id, item]));
      const minRequests = Number(query.minRequests || 0);
      const stats = new Map();

      for (const request of requests) {
        const item = equipmentMap.get(request.equipmentId);
        if (!item) continue;
        if (query.siteId && item.siteId !== query.siteId) continue;
        const key = request.equipmentId;
        const record = stats.get(key) || {
          equipmentId: key,
          equipmentName: item.name,
          siteId: item.siteId,
          type: item.type,
          totalRequests: 0,
          byStatus: { new: 0, in_progress: 0, done: 0, rejected: 0 },
          byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
        };

        record.totalRequests += 1;
        record.byStatus[request.status] = (record.byStatus[request.status] ?? 0) + 1;
        record.byPriority[request.priority] = (record.byPriority[request.priority] ?? 0) + 1;
        stats.set(key, record);
      }

      const data = [...stats.values()]
        .filter((record) => record.totalRequests >= minRequests)
        .sort((a, b) => b.totalRequests - a.totalRequests || a.equipmentName.localeCompare(b.equipmentName));

      return {
        period: query.period || 'all',
        minRequests,
        data,
      };
    },
    async remove(id) { await this.get(id); await requestRepository.remove(id); },
  };
}

const defaultRepositories = await createDefaultRepositories();
export const requestService = createRequestService(defaultRepositories.requestRepository, defaultRepositories.equipmentRepository);