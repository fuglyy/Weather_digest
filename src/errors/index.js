export class AppError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ресурс не найден') { super(404, 'NOT_FOUND', message); }
}

export class ValidationError extends AppError {
  constructor(details, message = 'Некорректные данные запроса') { super(422, 'VALIDATION_ERROR', message, details); }
}

export class ConflictError extends AppError {
  constructor(message, details = []) { super(409, 'CONFLICT', message, details); }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'Внешний погодный сервис недоступен') { super(503, 'EXTERNAL_SERVICE_ERROR', message); }
}