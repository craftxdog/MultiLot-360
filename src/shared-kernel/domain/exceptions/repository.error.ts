import { AppError } from './app.error';

export class RepositoryError extends AppError {
  constructor(
    message: string,
    cause?: Error,
    statusCode = 500,
    retryable = true,
  ) {
    super(message, statusCode, 'REPOSITORY_ERROR', cause, retryable);
  }
}
