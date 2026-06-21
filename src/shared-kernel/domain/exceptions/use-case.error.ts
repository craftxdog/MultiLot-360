import { AppError } from './app.error';

export class UseCaseError extends AppError {
  constructor(message: string, cause?: Error, statusCode = 422) {
    super(message, statusCode, 'USE_CASE_ERROR', cause, false);
  }
}
