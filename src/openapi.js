const jsonResponse = (description, schema = { $ref: '#/components/schemas/DataResponse' }) => ({
  description,
  content: { 'application/json': { schema } },
});

const errorResponses = {
  '401': jsonResponse('Требуется аутентификация', { $ref: '#/components/schemas/ErrorResponse' }),
  '403': jsonResponse('Недостаточно прав', { $ref: '#/components/schemas/ErrorResponse' }),
  '404': jsonResponse('Запись или маршрут не найдены', { $ref: '#/components/schemas/ErrorResponse' }),
  '409': jsonResponse('Конфликт данных или перехода статуса', { $ref: '#/components/schemas/ErrorResponse' }),
  '422': jsonResponse('Ошибка проверки входных данных', { $ref: '#/components/schemas/ErrorResponse' }),
};

const protectedOperation = (summary, responses, requestBody) => ({
  summary,
  security: [{ bearerAuth: [] }],
  ...(requestBody ? { requestBody: { required: true, content: { 'application/json': { schema: requestBody } } } } : {}),
  responses: { ...responses, ...errorResponses },
});

const listParameters = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
  { name: 'sortBy', in: 'query', schema: { type: 'string' } },
  { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
];

const idParameter = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const dataSchema = { type: 'object', additionalProperties: true };
const dataBody = { type: 'object', additionalProperties: true };

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Weather Digest Maintenance API',
    version: '1.0.0',
    description: 'API учёта оборудования, заявок на обслуживание и эксплуатационных метрик.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Authentication' },
    { name: 'Health' },
    { name: 'Equipment' },
    { name: 'Requests' },
    { name: 'Reports' },
  ],
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Зарегистрировать пользователя с ролью viewer',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          '201': jsonResponse('Пользователь создан'),
          '409': jsonResponse('Email уже зарегистрирован', { $ref: '#/components/schemas/ErrorResponse' }),
          '422': jsonResponse('Некорректные данные', { $ref: '#/components/schemas/ErrorResponse' }),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Войти и получить access token; refresh token устанавливается в HttpOnly cookie',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          '200': jsonResponse('Успешный вход', { $ref: '#/components/schemas/LoginResponse' }),
          '401': jsonResponse('Неверный email или пароль', { $ref: '#/components/schemas/ErrorResponse' }),
          '429': jsonResponse('Слишком много попыток входа', { $ref: '#/components/schemas/ErrorResponse' }),
        },
      },
    },
    '/api/auth/users': {
      post: {
        tags: ['Authentication'],
        summary: 'Создать учётную запись technician или admin (admin); technicianId связывает специалиста с назначениями',
        security: [{ bearerAuth: [] }],
        'x-required-roles': ['admin'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'role'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, role: { type: 'string', enum: ['technician', 'admin'] }, technicianId: { type: 'string', format: 'uuid', description: 'Required for technician; must refer to an existing technician.' } } } } } },
        responses: { '201': jsonResponse('Пользователь создан'), ...errorResponses },
      },
    },
    '/api/auth/refresh': {
      post: { tags: ['Authentication'], summary: 'Обновить access token из refresh cookie', responses: { '200': jsonResponse('Токен обновлён', { $ref: '#/components/schemas/LoginResponse' }), '401': errorResponses['401'] } },
    },
    '/api/auth/logout': {
      post: { tags: ['Authentication'], summary: 'Завершить refresh-сессию и удалить cookie', responses: { '204': { description: 'Сессия завершена' }, '401': errorResponses['401'] } },
    },
    '/api/auth/me': {
      get: { tags: ['Authentication'], ...protectedOperation('Получить текущего пользователя и роль', { '200': jsonResponse('Текущий пользователь') }) },
    },
    '/api/health': {
      get: { tags: ['Health'], summary: 'Проверить состояние API и PostgreSQL', responses: { '200': jsonResponse('Сервис доступен'), '503': jsonResponse('База данных недоступна', { $ref: '#/components/schemas/DataResponse' }) } },
    },
    '/api/health/live': {
      get: { tags: ['Health'], summary: 'Проверить, что процесс жив', responses: { '200': jsonResponse('Процесс жив') } },
    },
    '/api/health/ready': {
      get: { tags: ['Health'], summary: 'Проверить готовность API и доступность БД', responses: { '200': jsonResponse('Сервис готов'), '503': jsonResponse('Сервис не готов') } },
    },
    '/api/sites': {
      get: { tags: ['Reports'], ...protectedOperation('Получить список площадок', { '200': jsonResponse('Список площадок') }), parameters: listParameters },
      post: { tags: ['Reports'], ...protectedOperation('Создать площадку (admin)', { '201': jsonResponse('Площадка создана') }, { $ref: '#/components/schemas/SitePayload' }), 'x-required-roles': ['admin'] },
    },
    '/api/sites/{id}': {
      get: { tags: ['Reports'], ...protectedOperation('Получить площадку', { '200': jsonResponse('Карточка площадки') }), parameters: [idParameter] },
      patch: { tags: ['Reports'], ...protectedOperation('Изменить площадку (admin)', { '200': jsonResponse('Площадка изменена') }, { $ref: '#/components/schemas/SiteUpdate' }), parameters: [idParameter], 'x-required-roles': ['admin'] },
      delete: { tags: ['Reports'], ...protectedOperation('Удалить площадку (admin)', { '204': { description: 'Площадка удалена' } }), parameters: [idParameter], 'x-required-roles': ['admin'] },
    },
    '/api/technicians': {
      get: { tags: ['Authentication'], ...protectedOperation('Получить список специалистов', { '200': jsonResponse('Список специалистов') }), parameters: listParameters },
      post: { tags: ['Authentication'], ...protectedOperation('Создать специалиста (admin)', { '201': jsonResponse('Специалист создан') }, { $ref: '#/components/schemas/TechnicianPayload' }), 'x-required-roles': ['admin'] },
    },
    '/api/technicians/{id}': {
      get: { tags: ['Authentication'], ...protectedOperation('Получить специалиста', { '200': jsonResponse('Карточка специалиста') }), parameters: [idParameter] },
      patch: { tags: ['Authentication'], ...protectedOperation('Изменить специалиста (admin)', { '200': jsonResponse('Специалист изменён') }, { $ref: '#/components/schemas/TechnicianUpdate' }), parameters: [idParameter], 'x-required-roles': ['admin'] },
      delete: { tags: ['Authentication'], ...protectedOperation('Удалить специалиста (admin)', { '204': { description: 'Специалист удалён' } }), parameters: [idParameter], 'x-required-roles': ['admin'] },
    },
    '/api/equipment': {
      get: { tags: ['Equipment'], ...protectedOperation('Получить страницу оборудования', { '200': jsonResponse('Список оборудования') }), parameters: listParameters },
      post: { tags: ['Equipment'], ...protectedOperation('Создать оборудование (admin)', { '201': jsonResponse('Оборудование создано') }, { $ref: '#/components/schemas/EquipmentPayload' }), 'x-required-roles': ['admin'] },
    },
    '/api/equipment/{id}': {
      get: { tags: ['Equipment'], ...protectedOperation('Получить оборудование', { '200': jsonResponse('Карточка оборудования') }), parameters: [idParameter] },
      patch: { tags: ['Equipment'], ...protectedOperation('Изменить оборудование (admin)', { '200': jsonResponse('Оборудование изменено') }, dataBody), parameters: [idParameter], 'x-required-roles': ['admin'] },
      delete: { tags: ['Equipment'], ...protectedOperation('Удалить оборудование (admin)', { '204': { description: 'Оборудование удалено' } }), parameters: [idParameter], 'x-required-roles': ['admin'] },
    },
    '/api/equipment/{id}/requests': {
      get: { tags: ['Equipment'], ...protectedOperation('Получить заявки оборудования', { '200': jsonResponse('Заявки оборудования') }), parameters: [idParameter] },
    },
    '/api/equipment/{id}/weather': {
      get: { tags: ['Equipment'], ...protectedOperation('Получить прогноз погоды для работ', { '200': jsonResponse('Прогноз и пригодность работ') }), parameters: [idParameter] },
    },
    '/api/requests': {
      get: { tags: ['Requests'], ...protectedOperation('Получить страницу заявок', { '200': jsonResponse('Список заявок') }), parameters: [...listParameters, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'priority', in: 'query', schema: { type: 'string' } }, { name: 'equipmentId', in: 'query', schema: { type: 'string', format: 'uuid' } }] },
      post: { tags: ['Requests'], ...protectedOperation('Создать заявку (technician/admin)', { '201': jsonResponse('Заявка создана') }, { $ref: '#/components/schemas/MaintenanceRequestPayload' }), 'x-required-roles': ['technician', 'admin'] },
    },
    '/api/requests/{id}': {
      get: { tags: ['Requests'], ...protectedOperation('Получить заявку', { '200': jsonResponse('Карточка заявки') }), parameters: [idParameter] },
      patch: { tags: ['Requests'], ...protectedOperation('Изменить заявку (technician/admin)', { '200': jsonResponse('Заявка изменена') }, dataBody), parameters: [idParameter], 'x-required-roles': ['technician', 'admin'] },
      delete: { tags: ['Requests'], ...protectedOperation('Удалить заявку (admin)', { '204': { description: 'Заявка удалена' } }), parameters: [idParameter], 'x-required-roles': ['admin'] },
    },
    '/api/requests/{id}/status': {
      patch: { tags: ['Requests'], ...protectedOperation('Изменить статус заявки; technician должен быть назначен', { '200': jsonResponse('Статус изменён') }, { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['new', 'in_progress', 'done', 'rejected'] } } }), parameters: [idParameter], 'x-required-roles': ['technician', 'admin'] },
    },
    '/api/requests/{id}/assignees': {
      post: { tags: ['Requests'], ...protectedOperation('Назначить бригаду (admin)', { '201': jsonResponse('Бригада назначена') }, { type: 'array', items: { type: 'object', required: ['userId', 'role'], properties: { userId: { type: 'string', format: 'uuid' }, role: { type: 'string', enum: ['lead', 'member'] }, hours: { type: 'number' } } } }), parameters: [idParameter], 'x-required-roles': ['admin'] },
    },
    '/api/requests/{id}/assignees/{userId}': {
      delete: { tags: ['Requests'], ...protectedOperation('Снять специалиста с заявки (admin)', { '204': { description: 'Назначение удалено' } }), parameters: [idParameter, { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], 'x-required-roles': ['admin'] },
    },
    '/api/requests/{id}/history': {
      get: { tags: ['Requests'], ...protectedOperation('Получить историю статусов', { '200': jsonResponse('История заявки') }), parameters: [idParameter] },
    },
    '/api/sites/{id}/summary': {
      get: { tags: ['Reports'], ...protectedOperation('Получить сводку площадки', { '200': jsonResponse('Сводка площадки') }), parameters: [idParameter] },
    },
    '/api/reports/equipment-load': {
      get: { tags: ['Reports'], ...protectedOperation('Получить нагрузку на оборудование', { '200': jsonResponse('Отчёт по нагрузке') }), parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['all', 'week', 'month', 'quarter'] } }, { name: 'minRequests', in: 'query', schema: { type: 'integer', minimum: 0 } }, { name: 'siteId', in: 'query', schema: { type: 'string', format: 'uuid' } }] },
    },
    '/metrics': {
      get: { summary: 'Prometheus metrics endpoint; доступ ограничен сетевой политикой Nginx', responses: { '200': { description: 'Prometheus text exposition format', content: { 'text/plain': { schema: { type: 'string' } } } }, '403': { description: 'IP запрещён Nginx' } } },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      DataResponse: { type: 'object', required: ['data'], properties: { data: dataSchema } },
      ErrorResponse: {
        type: 'object', required: ['error'], properties: {
          error: { type: 'object', required: ['code', 'message', 'requestId'], properties: {
            code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' }, details: { type: 'array', items: { type: 'object' } },
          } },
        },
      },
      RegisterRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 } } },
      LoginRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } },
      LoginResponse: { type: 'object', properties: { data: { type: 'object', properties: { accessToken: { type: 'string' }, expiresIn: { type: 'integer' }, user: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['viewer', 'technician', 'admin'] } } } } } } },
      SitePayload: { type: 'object', required: ['name', 'code', 'region', 'lat', 'lon'], properties: { name: { type: 'string' }, code: { type: 'string' }, region: { type: 'string' }, lat: { type: 'number', minimum: -90, maximum: 90 }, lon: { type: 'number', minimum: -180, maximum: 180 } } },
      SiteUpdate: { type: 'object', properties: { name: { type: 'string' }, code: { type: 'string' }, region: { type: 'string' }, lat: { type: 'number', minimum: -90, maximum: 90 }, lon: { type: 'number', minimum: -180, maximum: 180 } } },
      TechnicianPayload: { type: 'object', required: ['fullName', 'specialization', 'personnelNumber'], properties: { id: { type: 'string', format: 'uuid' }, fullName: { type: 'string' }, specialization: { type: 'string' }, personnelNumber: { type: 'string' } } },
      TechnicianUpdate: { type: 'object', properties: { fullName: { type: 'string' }, specialization: { type: 'string' }, personnelNumber: { type: 'string' } } },
      EquipmentPayload: { type: 'object', required: ['name', 'type', 'serialNumber', 'location', 'status', 'installedAt'], properties: { siteId: { type: 'string', format: 'uuid' }, name: { type: 'string', minLength: 3, maxLength: 100 }, type: { type: 'string', enum: ['turbine', 'inverter', 'sensor', 'substation'] }, serialNumber: { type: 'string' }, location: { type: 'object', required: ['lat', 'lon'], properties: { lat: { type: 'number', minimum: -90, maximum: 90 }, lon: { type: 'number', minimum: -180, maximum: 180 } } }, status: { type: 'string', enum: ['operational', 'maintenance', 'fault', 'decommissioned'] }, installedAt: { type: 'string', format: 'date-time' } } },
      MaintenanceRequestPayload: { type: 'object', required: ['equipmentId', 'title', 'priority'], properties: { equipmentId: { type: 'string', format: 'uuid' }, title: { type: 'string', minLength: 5, maxLength: 120 }, description: { type: 'string', maxLength: 2000 }, priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, plannedAt: { type: 'string', format: 'date-time' } } },
    },
  },
};