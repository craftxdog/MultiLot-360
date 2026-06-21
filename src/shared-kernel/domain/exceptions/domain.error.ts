import { AppError } from './app.error';

export class DomainError extends AppError {
  constructor(message: string, cause?: Error, statusCode = 400) {
    super(message, statusCode, 'DOMAIN_ERROR', cause, false);
  }
}
