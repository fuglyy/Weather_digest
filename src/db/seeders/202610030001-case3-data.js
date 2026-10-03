import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Op } from 'sequelize';

const siteIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];
const technicianIds = [
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
];

async function readLegacyArray(filename) {
  try {
    const content = await fs.readFile(path.resolve(process.env.DATA_DIR || 'data', filename), 'utf8');
    const value = JSON.parse(content);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function dateDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function demoEquipment() {
  const templates = [
    ['Турбина A-01', 'turbine', 'operational'],
    ['Турбина A-02', 'turbine', 'maintenance'],
    ['Инвертор B-01', 'inverter', 'operational'],
    ['Инвертор B-02', 'inverter', 'fault'],
    ['Датчик C-01', 'sensor', 'operational'],
    ['Подстанция D-01', 'substation', 'operational'],
  ];
  return templates.map(([name, type, status], index) => ({
    oldId: null,
    id: randomUUID(),
    site_id: siteIds[index % siteIds.length],
    name,
    type,
    serial_number: `CASE3-EQ-${String(index + 1).padStart(3, '0')}`,
    status,
    installed_at: dateDaysAgo(500 + index * 20),
  }));
}

function demoRequests(equipment) {
  const priorities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['new', 'in_progress', 'done', 'rejected'];
  return Array.from({ length: 20 }, (_, index) => ({
    id: randomUUID(),
    equipment_id: equipment[index % equipment.length].id,
    title: `Демонстрационная заявка ${String(index + 1).padStart(2, '0')}`,
    description: 'Демонстрационные данные для проверки API и аналитических отчётов.',
    priority: priorities[index % priorities.length],
    status: statuses[index % statuses.length],
    planned_at: dateDaysAgo(index - 3),
    created_by: 'case3-seed',
    created_at: dateDaysAgo((index * 5) % 100 + 1),
    updated_at: dateDaysAgo((index * 5) % 100),
  }));
}

export async function up(queryInterface) {
  const legacyEquipment = await readLegacyArray('equipment.json');
  const legacyRequests = await readLegacyArray('requests.json');
  const now = new Date();

  await queryInterface.bulkInsert('sites', [
    { id: siteIds[0], name: 'Московская производственная площадка', code: 'CASE3-MSK', region: 'Москва', lat: 55.7522, lon: 37.6156 },
    { id: siteIds[1], name: 'Казанская энергетическая площадка', code: 'CASE3-KZN', region: 'Казань', lat: 55.7963, lon: 49.1089 },
  ]);

  const equipment = legacyEquipment.length
    ? legacyEquipment.map((record, index) => ({
      oldId: record.id,
      id: randomUUID(),
      site_id: siteIds[index % siteIds.length],
      name: record.name || `Импортированное оборудование ${index + 1}`,
      type: record.type || 'sensor',
      serial_number: `CASE3-${record.serialNumber || `IMPORTED-${index + 1}`}`,
      status: record.status || 'operational',
      installed_at: record.installedAt || now,
    }))
    : demoEquipment();
  const equipmentIds = new Map(equipment.map((record) => [record.oldId, record.id]));
  await queryInterface.bulkInsert('equipment', equipment.map(({ oldId: _oldId, ...record }) => record));

  await queryInterface.bulkInsert('equipment_passports', equipment.map((record) => ({
    id: randomUUID(),
    equipment_id: record.id,
    manufacturer: 'Demo manufacturer',
    model: 'CASE3',
    rated_power: 100,
    last_calibration_at: now,
  })));

  const technicians = technicianIds.map((id, index) => ({
    id,
    full_name: ['Иван Петров', 'Мария Сидорова', 'Алексей Кузнецов', 'Елена Волкова', 'Дмитрий Орлов'][index],
    specialization: ['механика', 'электрика', 'контроль качества', 'автоматика', 'энергетика'][index],
    personnel_number: `CASE3-TECH-${String(index + 1).padStart(3, '0')}`,
  }));
  await queryInterface.bulkInsert('technicians', technicians);

  const requests = legacyRequests.length
    ? legacyRequests.map((record, index) => ({
      id: randomUUID(),
      equipment_id: equipmentIds.get(record.equipmentId) || equipment[index % equipment.length].id,
      title: record.title || `Импортированная заявка ${index + 1}`,
      description: record.description || null,
      priority: record.priority || 'medium',
      status: ['new', 'in_progress', 'done', 'rejected'].includes(record.status) ? record.status : 'new',
      planned_at: record.plannedAt || null,
      created_by: record.createdBy || 'case2-import',
      created_at: record.createdAt || now,
      updated_at: record.updatedAt || now,
    }))
    : demoRequests(equipment);
  await queryInterface.bulkInsert('maintenance_requests', requests);

  const histories = [];
  const assignees = [];
  for (const [index, record] of requests.entries()) {
    const technicianId = technicianIds[index % technicianIds.length];
    assignees.push({ id: randomUUID(), request_id: record.id, technician_id: technicianId, role: 'lead', hours: 2 });
    if (record.status === 'in_progress') {
      histories.push({ id: randomUUID(), request_id: record.id, old_status: 'new', new_status: 'in_progress', changed_by: 'case3-seed', comment: 'Импорт/seed: работа начата', created_at: record.updated_at });
    } else if (record.status === 'done') {
      histories.push(
        { id: randomUUID(), request_id: record.id, old_status: 'new', new_status: 'in_progress', changed_by: 'case3-seed', comment: 'Импорт/seed: работа начата', created_at: record.created_at },
        { id: randomUUID(), request_id: record.id, old_status: 'in_progress', new_status: 'done', changed_by: 'case3-seed', comment: 'Импорт/seed: работа завершена', created_at: record.updated_at },
      );
    } else if (record.status === 'rejected') {
      histories.push({ id: randomUUID(), request_id: record.id, old_status: 'new', new_status: 'rejected', changed_by: 'case3-seed', comment: 'Импорт/seed: заявка отклонена', created_at: record.updated_at });
    }
  }
  if (histories.length) await queryInterface.bulkInsert('request_status_history', histories);
  if (assignees.length) await queryInterface.bulkInsert('request_assignees', assignees);
}

export async function down(queryInterface) {
  const [equipment] = await queryInterface.sequelize.query(
    "SELECT id FROM equipment WHERE serial_number LIKE 'CASE3-%'",
  );
  const equipmentIds = equipment.map((row) => row.id);
  const [requests] = equipmentIds.length
    ? await queryInterface.sequelize.query('SELECT id FROM maintenance_requests WHERE equipment_id IN (:equipmentIds)', { replacements: { equipmentIds } })
    : [[]];
  const requestIds = requests.map((row) => row.id);

  if (requestIds.length) {
    await queryInterface.bulkDelete('request_assignees', { request_id: requestIds });
    await queryInterface.bulkDelete('request_status_history', { request_id: requestIds });
    await queryInterface.bulkDelete('maintenance_requests', { id: requestIds });
  }
  if (equipmentIds.length) {
    await queryInterface.bulkDelete('equipment_passports', { equipment_id: equipmentIds });
    await queryInterface.bulkDelete('equipment', { id: equipmentIds });
  }
  await queryInterface.bulkDelete('technicians', { personnel_number: { [Op.like]: 'CASE3-TECH-%' } });
  await queryInterface.bulkDelete('sites', { code: { [Op.in]: ['CASE3-MSK', 'CASE3-KZN'] } });
}
