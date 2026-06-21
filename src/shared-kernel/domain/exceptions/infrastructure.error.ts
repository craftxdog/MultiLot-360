import { AppError } from './app.error';

export class InfrastructureError extends AppError {
  constructor(
    message: string,
    cause?: Error,
    statusCode = 500,
    retryable = true,
  ) {
    super(message, statusCode, 'INFRASTRUCTURE_ERROR', cause, retryable);
  }
}
