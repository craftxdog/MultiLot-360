import { AppError } from './app.error';

export class ServiceError extends AppError {
  constructor(message: string, cause?: Error, statusCode = 422) {
    super(message, statusCode, 'SERVICE_ERROR', cause, false);
  }
}
