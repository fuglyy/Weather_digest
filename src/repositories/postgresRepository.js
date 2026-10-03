import { Op } from 'sequelize';

import { sequelize } from '../db/index.js';
import {
  Equipment,
  MaintenanceRequest,
  RequestAssignee,
  RequestStatusHistory,
  Site,
} from '../db/models/index.js';
import { createFileRepository } from './fileRepository.js';

const equipmentSortColumns = new Set(['name', 'type', 'serialNumber', 'status', 'installedAt']);
const requestSortColumns = new Set(['title', 'priority', 'status', 'plannedAt', 'createdAt', 'updatedAt']);

function toEquipment(row) {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    type: row.type,
    serialNumber: row.serialNumber,
    status: row.status,
    installedAt: row.installedAt,
    location: row.site ? { lat: row.site.lat, lon: row.site.lon } : null,
  };
}

async function ensureSite(record) {
  if (record.siteId) return record.siteId;
  const { lat, lon } = record.location || {};
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  const code = `API-${lat.toFixed(5)}-${lon.toFixed(5)}`.replaceAll('-', 'N');
  const [site] = await Site.findOrCreate({
    where: { code },
    defaults: {
      name: 'Автоматически созданная площадка',
      region: 'Не указан',
      lat,
      lon,
    },
  });
  return site.id;
}

async function hydrateRequests(rows, transaction) {
  if (!rows.length) return [];
  const requestIds = rows.map((row) => row.id);
  const [assignees, history] = await Promise.all([
    RequestAssignee.findAll({
      where: { requestId: { [Op.in]: requestIds } },
      raw: true,
      transaction,
    }),
    RequestStatusHistory.findAll({
      where: { requestId: { [Op.in]: requestIds } },
      order: [['createdAt', 'ASC']],
      raw: true,
      transaction,
    }),
  ]);
  const assigneesByRequest = new Map();
  const historyByRequest = new Map();
  for (const entry of assignees) {
    const list = assigneesByRequest.get(entry.requestId) || [];
    list.push({ userId: entry.technicianId, technicianId: entry.technicianId, role: entry.role, hours: Number(entry.hours) });
    assigneesByRequest.set(entry.requestId, list);
  }
  for (const entry of history) {
    const list = historyByRequest.get(entry.requestId) || [];
    list.push(entry);
    historyByRequest.set(entry.requestId, list);
  }
  return rows.map((row) => {
    const assigneeList = assigneesByRequest.get(row.id) || [];
    return {
      ...row,
      assignees: assigneeList,
      assignedTechnicians: assigneeList,
      statusHistory: historyByRequest.get(row.id) || [],
    };
  });
}

function periodStart(period) {
  const days = { week: 7, month: 30, quarter: 90 }[period];
  return days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
}

export async function createPostgresEquipmentRepository() {
  return {
    async findAll() {
      const rows = await Equipment.findAll({
        include: [{ model: Site, as: 'site', attributes: ['id', 'lat', 'lon'] }],
        attributes: ['id', 'siteId', 'name', 'type', 'serialNumber', 'status', 'installedAt'],
        order: [['name', 'ASC']],
        raw: true,
        nest: true,
      });
      return rows.map(toEquipment);
    },

    async list(query = {}) {
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 20);
      const sortBy = equipmentSortColumns.has(query.sortBy) ? query.sortBy : 'name';
      const where = {};
      if (query.type) where.type = query.type;
      if (query.status) where.status = query.status;
      const result = await Equipment.findAndCountAll({
        where,
        include: [{ model: Site, as: 'site', attributes: ['id', 'lat', 'lon'] }],
        attributes: ['id', 'siteId', 'name', 'type', 'serialNumber', 'status', 'installedAt'],
        order: [[sortBy, query.order === 'desc' ? 'DESC' : 'ASC']],
        limit,
        offset: (page - 1) * limit,
        distinct: true,
        raw: true,
        nest: true,
      });
      return { data: result.rows.map(toEquipment), meta: { total: result.count, page, limit } };
    },

    async findById(id) {
      const row = await Equipment.findOne({
        where: { id },
        include: [{ model: Site, as: 'site', attributes: ['id', 'lat', 'lon'] }],
        attributes: ['id', 'siteId', 'name', 'type', 'serialNumber', 'status', 'installedAt'],
        raw: true,
        nest: true,
      });

      if (!row) return null;
      return toEquipment(row);
    },

    async create(record) {
      const siteId = await ensureSite(record);
      const item = await Equipment.create({
        siteId,
        name: record.name,
        type: record.type,
        serialNumber: record.serialNumber,
        status: record.status ?? 'operational',
        installedAt: record.installedAt,
      });
      return this.findById(item.id);
    },

    async update(id, changes, options = {}) {
      const item = await Equipment.findByPk(id, { transaction: options.transaction });
      if (!item) return null;
      const siteId = changes.siteId || (changes.location ? await ensureSite(changes) : item.siteId);
      await item.update({
        siteId,
        name: changes.name ?? item.name,
        type: changes.type ?? item.type,
        serialNumber: changes.serialNumber ?? item.serialNumber,
        status: changes.status ?? item.status,
        installedAt: changes.installedAt ?? item.installedAt,
      });
      return this.findById(id);
    },

    async remove(id) {
      const deleted = await Equipment.destroy({ where: { id } });
      return deleted > 0;
    },
  };
}

export async function createPostgresRequestRepository() {
  return {
    async findAll() {
      const rows = await MaintenanceRequest.findAll({
        attributes: ['id', 'equipmentId', 'title', 'description', 'priority', 'status', 'plannedAt', 'createdBy', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        raw: true,
      });
      return hydrateRequests(rows);
    },

    async list(query = {}) {
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 20);
      const sortBy = requestSortColumns.has(query.sortBy) ? query.sortBy : 'createdAt';
      const where = {};
      for (const key of ['equipmentId', 'status', 'priority']) if (query[key]) where[key] = query[key];
      const result = await MaintenanceRequest.findAndCountAll({
        where,
        attributes: ['id', 'equipmentId', 'title', 'description', 'priority', 'status', 'plannedAt', 'createdBy', 'createdAt', 'updatedAt'],
        order: [[sortBy, query.order === 'asc' ? 'ASC' : 'DESC']],
        limit,
        offset: (page - 1) * limit,
        distinct: true,
        raw: true,
      });
      return {
        data: await hydrateRequests(result.rows),
        meta: { total: result.count, page, limit },
      };
    },

    async findById(id) {
      const row = await MaintenanceRequest.findByPk(id, {
        attributes: ['id', 'equipmentId', 'title', 'description', 'priority', 'status', 'plannedAt', 'createdBy', 'createdAt', 'updatedAt'],
        raw: true,
      });

      if (!row) return null;
      return (await hydrateRequests([row]))[0];
    },

    async create(record) {
      const item = await MaintenanceRequest.create({
        equipmentId: record.equipmentId,
        title: record.title,
        description: record.description,
        priority: record.priority,
        status: record.status ?? 'new',
        plannedAt: record.plannedAt ?? null,
        createdBy: record.createdBy ?? 'system',
        createdAt: record.createdAt ?? new Date(),
        updatedAt: record.updatedAt ?? new Date(),
      });
      return this.findById(item.id);
    },

    async update(id, changes, options = {}) {
      const item = await MaintenanceRequest.findByPk(id, { transaction: options.transaction });
      if (!item) return null;
      await item.update({
        equipmentId: changes.equipmentId ?? item.equipmentId,
        title: changes.title ?? item.title,
        description: changes.description ?? item.description,
        priority: changes.priority ?? item.priority,
        status: changes.status ?? item.status,
        plannedAt: changes.plannedAt ?? item.plannedAt,
        updatedAt: changes.updatedAt ?? new Date(),
      });
      return this.findById(id);
    },

    async changeStatusWithHistory(id, oldStatus, status, updatedAt) {
      return sequelize.transaction(async (transaction) => {
        const [updatedCount] = await MaintenanceRequest.update(
          { status, updatedAt },
          { where: { id, status: oldStatus }, transaction },
        );
        if (!updatedCount) return null;
        await RequestStatusHistory.create({
          requestId: id,
          oldStatus,
          newStatus: status,
          changedBy: 'system',
          comment: `Статус изменён на ${status}`,
          createdAt: new Date(updatedAt),
        }, { transaction });
        const row = await MaintenanceRequest.findByPk(id, {
          attributes: ['id', 'equipmentId', 'title', 'description', 'priority', 'status', 'plannedAt', 'createdBy', 'createdAt', 'updatedAt'],
          raw: true,
          transaction,
        });
        return (await hydrateRequests([row], transaction))[0];
      });
    },

    async replaceAssignees(id, assignees, updatedAt) {
      return sequelize.transaction(async (transaction) => {
        const request = await MaintenanceRequest.findByPk(id, { transaction });
        if (!request) return null;
        await RequestAssignee.destroy({ where: { requestId: id }, transaction });
        await RequestAssignee.bulkCreate(assignees.map((entry) => ({
          requestId: id,
          technicianId: entry.userId,
          role: entry.role,
          hours: entry.hours,
        })), { transaction });
        await request.update({ updatedAt }, { transaction });
        const row = await MaintenanceRequest.findByPk(id, {
          attributes: ['id', 'equipmentId', 'title', 'description', 'priority', 'status', 'plannedAt', 'createdBy', 'createdAt', 'updatedAt'],
          raw: true,
          transaction,
        });
        return (await hydrateRequests([row], transaction))[0];
      });
    },

    async removeAssignee(id, technicianId, updatedAt) {
      return sequelize.transaction(async (transaction) => {
        const deleted = await RequestAssignee.destroy({ where: { requestId: id, technicianId }, transaction });
        if (!deleted) return false;
        await MaintenanceRequest.update({ updatedAt }, { where: { id }, transaction });
        return true;
      });
    },

    async siteSummary(siteId) {
      const [row] = await sequelize.query(`
        SELECT s.id AS "siteId", COUNT(r.id)::int AS "totalRequests",
          COUNT(r.id) FILTER (WHERE r.status = 'new')::int AS "statusNew",
          COUNT(r.id) FILTER (WHERE r.status = 'in_progress')::int AS "statusInProgress",
          COUNT(r.id) FILTER (WHERE r.status = 'done')::int AS "statusDone",
          COUNT(r.id) FILTER (WHERE r.status = 'rejected')::int AS "statusRejected",
          COUNT(r.id) FILTER (WHERE r.priority = 'low')::int AS "priorityLow",
          COUNT(r.id) FILTER (WHERE r.priority = 'medium')::int AS "priorityMedium",
          COUNT(r.id) FILTER (WHERE r.priority = 'high')::int AS "priorityHigh",
          COUNT(r.id) FILTER (WHERE r.priority = 'critical')::int AS "priorityCritical",
          COALESCE(AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 3600)
            FILTER (WHERE r.status = 'done'), 0) AS "averageCloseHours"
        FROM sites s
        LEFT JOIN equipment e ON e.site_id = s.id
        LEFT JOIN maintenance_requests r ON r.equipment_id = e.id
        WHERE s.id = :siteId
        GROUP BY s.id`,
      { replacements: { siteId }, type: 'SELECT' });
      if (!row) return null;
      return {
        siteId: row.siteId,
        totalRequests: Number(row.totalRequests),
        byStatus: { new: Number(row.statusNew), in_progress: Number(row.statusInProgress), done: Number(row.statusDone), rejected: Number(row.statusRejected) },
        byPriority: { low: Number(row.priorityLow), medium: Number(row.priorityMedium), high: Number(row.priorityHigh), critical: Number(row.priorityCritical) },
        averageCloseHours: Number(Number(row.averageCloseHours).toFixed(2)),
      };
    },

    async equipmentLoad(query = {}) {
      const minRequests = Math.max(0, Number(query.minRequests || 0));
      const startAt = periodStart(query.period || 'all');
      const data = await sequelize.query(`
        SELECT e.id AS "equipmentId", e.name AS "equipmentName", e.site_id AS "siteId", e.type,
          COUNT(r.id)::int AS "totalRequests",
          COUNT(r.id) FILTER (WHERE r.status = 'new')::int AS "statusNew",
          COUNT(r.id) FILTER (WHERE r.status = 'in_progress')::int AS "statusInProgress",
          COUNT(r.id) FILTER (WHERE r.status = 'done')::int AS "statusDone",
          COUNT(r.id) FILTER (WHERE r.status = 'rejected')::int AS "statusRejected",
          COUNT(r.id) FILTER (WHERE r.priority = 'low')::int AS "priorityLow",
          COUNT(r.id) FILTER (WHERE r.priority = 'medium')::int AS "priorityMedium",
          COUNT(r.id) FILTER (WHERE r.priority = 'high')::int AS "priorityHigh",
          COUNT(r.id) FILTER (WHERE r.priority = 'critical')::int AS "priorityCritical"
        FROM equipment e
        LEFT JOIN maintenance_requests r ON r.equipment_id = e.id
          AND (CAST(:startAt AS TIMESTAMPTZ) IS NULL OR r.created_at >= :startAt)
        WHERE (:siteId IS NULL OR e.site_id = :siteId)
        GROUP BY e.id
        HAVING COUNT(r.id) >= :minRequests
        ORDER BY COUNT(r.id) DESC, e.name ASC`,
      { replacements: { startAt, siteId: query.siteId || null, minRequests }, type: 'SELECT' });
      return {
        period: query.period || 'all',
        minRequests,
        data: data.map((row) => ({
          equipmentId: row.equipmentId,
          equipmentName: row.equipmentName,
          siteId: row.siteId,
          type: row.type,
          totalRequests: Number(row.totalRequests),
          byStatus: { new: Number(row.statusNew), in_progress: Number(row.statusInProgress), done: Number(row.statusDone), rejected: Number(row.statusRejected) },
          byPriority: { low: Number(row.priorityLow), medium: Number(row.priorityMedium), high: Number(row.priorityHigh), critical: Number(row.priorityCritical) },
        })),
      };
    },

    async remove(id) {
      const deleted = await MaintenanceRequest.destroy({ where: { id } });
      return deleted > 0;
    },
  };
}

export async function createDefaultRepositories() {
  const usePostgres = process.env.USE_POSTGRES === 'true';
  if (!usePostgres) {
    return {
      equipmentRepository: createFileRepository('equipment.json'),
      requestRepository: createFileRepository('requests.json'),
    };
  }

  return {
    equipmentRepository: await createPostgresEquipmentRepository(),
    requestRepository: await createPostgresRequestRepository(),
  };
}
