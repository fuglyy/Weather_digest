export async function up(queryInterface) {
  const now = new Date();

  const [site1Id] = await queryInterface.sequelize.query(
    "INSERT INTO sites (id, name, code, region, lat, lon) VALUES (:id, :name, :code, :region, :lat, :lon) RETURNING id",
    {
      replacements: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Московский нефтехимический узел',
        code: 'MSK-01',
        region: 'Москва',
        lat: 55.7522,
        lon: 37.6156,
      },
    },
  );

  const [site2Id] = await queryInterface.sequelize.query(
    "INSERT INTO sites (id, name, code, region, lat, lon) VALUES (:id, :name, :code, :region, :lat, :lon) RETURNING id",
    {
      replacements: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Казанский энергетический блок',
        code: 'KZN-02',
        region: 'Казань',
        lat: 55.7963,
        lon: 49.1089,
      },
    },
  );

  const equipment = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      site_id: site1Id[0]?.id || site1Id.id,
      name: 'Турбина A-01',
      type: 'turbine',
      serial_number: 'WT-1001',
      status: 'operational',
      installed_at: now,
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      site_id: site1Id[0]?.id || site1Id.id,
      name: 'Инвертор B-07',
      type: 'inverter',
      serial_number: 'INV-2001',
      status: 'maintenance',
      installed_at: now,
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      site_id: site2Id[0]?.id || site2Id.id,
      name: 'Датчик C-15',
      type: 'sensor',
      serial_number: 'SNS-3001',
      status: 'operational',
      installed_at: now,
    },
  ];

  await queryInterface.bulkInsert('equipment', equipment);

  await queryInterface.bulkInsert('equipment_passports', [
    {
      id: '66666666-6666-4666-8666-666666666666',
      equipment_id: equipment[0].id,
      manufacturer: 'RotorTech',
      model: 'RT-1200',
      rated_power: 1200.5,
      last_calibration_at: now,
    },
    {
      id: '77777777-7777-4777-8777-777777777777',
      equipment_id: equipment[1].id,
      manufacturer: 'VoltCore',
      model: 'VC-450',
      rated_power: 450.0,
      last_calibration_at: now,
    },
    {
      id: '88888888-8888-4888-8888-888888888888',
      equipment_id: equipment[2].id,
      manufacturer: 'Sensy',
      model: 'S-10',
      rated_power: 15.2,
      last_calibration_at: now,
    },
  ]);

  const technicians = [
    {
      id: '99999999-9999-4999-8999-999999999999',
      full_name: 'Иван Петров',
      specialization: 'механика',
      personnel_number: 'TECH-001',
    },
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      full_name: 'Мария Сидорова',
      specialization: 'электрика',
      personnel_number: 'TECH-002',
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      full_name: 'Алексей Кузнецов',
      specialization: 'контроль качества',
      personnel_number: 'TECH-003',
    },
  ];

  await queryInterface.bulkInsert('technicians', technicians);

  const requests = [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      equipment_id: equipment[0].id,
      title: 'Проверить балансировку ротора',
      description: 'Нужно провести диагностику и выверку.',
      priority: 'high',
      status: 'in_progress',
      planned_at: new Date(Date.now() + 86400000),
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      equipment_id: equipment[1].id,
      title: 'Сменить силовой модуль',
      description: 'Плановая замена модуля и проверка нагрузки.',
      priority: 'medium',
      status: 'new',
      planned_at: new Date(Date.now() + 172800000),
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      equipment_id: equipment[2].id,
      title: 'Проверить сенсорный поток',
      description: 'Проверка целостности кабеля и калибровки.',
      priority: 'low',
      status: 'done',
      planned_at: new Date(Date.now() - 86400000),
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
  ];

  await queryInterface.bulkInsert('maintenance_requests', requests);

  await queryInterface.bulkInsert('request_status_history', [
    {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      request_id: requests[0].id,
      old_status: 'new',
      new_status: 'in_progress',
      changed_by: 'system',
      comment: 'Назначена бригада и начата работа.',
      created_at: now,
    },
    {
      id: '12121212-1212-4121-8121-121212121212',
      request_id: requests[2].id,
      old_status: 'new',
      new_status: 'done',
      changed_by: 'system',
      comment: 'Работа завершена.',
      created_at: now,
    },
  ]);

  await queryInterface.bulkInsert('request_assignees', [
    {
      id: '13131313-1313-4131-8131-131313131313',
      request_id: requests[0].id,
      technician_id: technicians[0].id,
      role: 'lead',
      hours: 4.5,
    },
    {
      id: '14141414-1414-4141-8141-141414141414',
      request_id: requests[0].id,
      technician_id: technicians[1].id,
      role: 'member',
      hours: 3.0,
    },
  ]);
}

export async function down(queryInterface) {
  await queryInterface.bulkDelete('request_assignees', null, {});
  await queryInterface.bulkDelete('request_status_history', null, {});
  await queryInterface.bulkDelete('maintenance_requests', null, {});
  await queryInterface.bulkDelete('technicians', null, {});
  await queryInterface.bulkDelete('equipment_passports', null, {});
  await queryInterface.bulkDelete('equipment', null, {});
  await queryInterface.bulkDelete('sites', null, {});
}
