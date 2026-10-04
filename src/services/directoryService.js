import { NotFoundError, ValidationError } from '../errors/index.js';
import { Site, Technician } from '../db/models/index.js';
import { isUuid } from '../middleware/validate.js';

function validateSite(payload, partial = false) {
  const errors = [];
  const required = ['name', 'code', 'region', 'lat', 'lon'];
  if (!partial) for (const field of required) if (payload[field] === undefined) errors.push({ field, message: 'Поле обязательно' });
  for (const field of ['name', 'code', 'region']) {
    if (payload[field] !== undefined && (typeof payload[field] !== 'string' || !payload[field].trim())) errors.push({ field, message: 'Ожидается непустая строка' });
  }
  if (payload.lat !== undefined && (typeof payload.lat !== 'number' || payload.lat < -90 || payload.lat > 90)) errors.push({ field: 'lat', message: 'Ожидается координата от -90 до 90' });
  if (payload.lon !== undefined && (typeof payload.lon !== 'number' || payload.lon < -180 || payload.lon > 180)) errors.push({ field: 'lon', message: 'Ожидается координата от -180 до 180' });
  return errors;
}

function validateTechnician(payload, partial = false) {
  const errors = [];
  const required = ['fullName', 'specialization', 'personnelNumber'];
  if (!partial) for (const field of required) if (payload[field] === undefined) errors.push({ field, message: 'Поле обязательно' });
  for (const field of required) {
    if (payload[field] !== undefined && (typeof payload[field] !== 'string' || !payload[field].trim())) errors.push({ field, message: 'Ожидается непустая строка' });
  }
  if (payload.id !== undefined && !isUuid(payload.id)) errors.push({ field: 'id', message: 'Ожидается UUID' });
  return errors;
}

function pageOptions(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function createDirectoryService(models = {}) {
  const siteModel = models.Site || Site;
  const technicianModel = models.Technician || Technician;

  return {
    async listSites(query) {
      const { page, limit, offset } = pageOptions(query);
      const result = await siteModel.findAndCountAll({ order: [['name', 'ASC']], limit, offset });
      return { data: result.rows, meta: { total: result.count, page, limit } };
    },
    async getSite(id) {
      const record = await siteModel.findByPk(id);
      if (!record) throw new NotFoundError('Площадка не найдена');
      return record;
    },
    async createSite(payload) {
      const errors = validateSite(payload);
      if (errors.length) throw new ValidationError(errors);
      return siteModel.create(Object.fromEntries(['name', 'code', 'region', 'lat', 'lon'].map((field) => [field, payload[field]])));
    },
    async updateSite(id, payload) {
      await this.getSite(id);
      const errors = validateSite(payload, true);
      if (errors.length) throw new ValidationError(errors);
      await siteModel.update(Object.fromEntries(['name', 'code', 'region', 'lat', 'lon'].filter((field) => payload[field] !== undefined).map((field) => [field, payload[field]])), { where: { id } });
      return this.getSite(id);
    },
    async removeSite(id) {
      const count = await siteModel.destroy({ where: { id } });
      if (!count) throw new NotFoundError('Площадка не найдена');
    },
    async listTechnicians(query) {
      const { page, limit, offset } = pageOptions(query);
      const result = await technicianModel.findAndCountAll({ order: [['fullName', 'ASC']], limit, offset });
      return { data: result.rows, meta: { total: result.count, page, limit } };
    },
    async getTechnician(id) {
      const record = await technicianModel.findByPk(id);
      if (!record) throw new NotFoundError('Специалист не найден');
      return record;
    },
    async createTechnician(payload) {
      const errors = validateTechnician(payload);
      if (errors.length) throw new ValidationError(errors);
      return technicianModel.create(Object.fromEntries(['id', 'fullName', 'specialization', 'personnelNumber'].filter((field) => payload[field] !== undefined).map((field) => [field, payload[field]])));
    },
    async updateTechnician(id, payload) {
      await this.getTechnician(id);
      const errors = validateTechnician(payload, true);
      if (errors.length) throw new ValidationError(errors);
      await technicianModel.update(Object.fromEntries(['fullName', 'specialization', 'personnelNumber'].filter((field) => payload[field] !== undefined).map((field) => [field, payload[field]])), { where: { id } });
      return this.getTechnician(id);
    },
    async removeTechnician(id) {
      const count = await technicianModel.destroy({ where: { id } });
      if (!count) throw new NotFoundError('Специалист не найден');
    },
  };
}

export const directoryService = createDirectoryService();
export { createDirectoryService };