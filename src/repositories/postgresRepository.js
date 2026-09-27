import { Op } from 'sequelize';

import { sequelize } from '../db/index.js';
import { Equipment, MaintenanceRequest, Site } from '../db/models/index.js';
import { createFileRepository } from './fileRepository.js';

async function isDatabaseAvailable() {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
}

export async function createPostgresEquipmentRepository() {
  if (!(await isDatabaseAvailable())) {
    return createFileRepository('equipment.json');
  }

  return {
    async findAll() {
      const rows = await Equipment.findAll({
        include: [{ model: Site, as: 'site', attributes: ['id', 'lat', 'lon'] }],
        attributes: ['id', 'siteId', 'name', 'type', 'serialNumber', 'status', 'installedAt'],
        order: [['name', 'ASC']],
        raw: true,
        nest: true,
      });

      return rows.map((row) => ({
        id: row.id,
        siteId: row.siteId,
        name: row.name,
        type: row.type,
        serialNumber: row.serialNumber,
        status: row.status,
        installedAt: row.installedAt,
        location: row.site ? { lat: row.site.lat, lon: row.site.lon } : { lat: 0, lon: 0 },
      }));
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
      return {
        id: row.id,
        siteId: row.siteId,
        name: row.name,
        type: row.type,
        serialNumber: row.serialNumber,
        status: row.status,
        installedAt: row.installedAt,
        location: row.site ? { lat: row.site.lat, lon: row.site.lon } : { lat: 0, lon: 0 },
      };
    },

    async create(record) {
      const item = await Equipment.create({
        siteId: record.siteId ?? null,
        name: record.name,
        type: record.type,
        serialNumber: record.serialNumber,
        status: record.status ?? 'operational',
        installedAt: record.installedAt,
      });
      return this.findById(item.id);
    },

    async update(id, changes) {
      const item = await Equipment.findByPk(id);
      if (!item) return null;
      await item.update({
        siteId: changes.siteId ?? item.siteId,
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
  if (!(await isDatabaseAvailable())) {
    return createFileRepository('requests.json');
  }

  return {
    async findAll() {
      const rows = await MaintenanceRequest.findAll({
        attributes: ['id', 'equipmentId', 'title', 'description', 'priority', 'status', 'plannedAt', 'createdBy', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
        raw: true,
      });

      return rows.map((row) => ({
        id: row.id,
        equipmentId: row.equipmentId,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: row.status,
        plannedAt: row.plannedAt,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },

    async findById(id) {
      const row = await MaintenanceRequest.findByPk(id, {
        attributes: ['id', 'equipmentId', 'title', 'description', 'priority', 'status', 'plannedAt', 'createdBy', 'createdAt', 'updatedAt'],
        raw: true,
      });

      if (!row) return null;
      return {
        id: row.id,
        equipmentId: row.equipmentId,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: row.status,
        plannedAt: row.plannedAt,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
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

    async update(id, changes) {
      const item = await MaintenanceRequest.findByPk(id);
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
