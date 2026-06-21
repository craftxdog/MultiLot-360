import { Result } from '../result';
import { DomainError } from './domain.error';
import { InfrastructureError } from './infrastructure.error';
import { RepositoryError } from './repository.error';
import { ServiceError } from './service.error';
import { UseCaseError } from './use-case.error';

const isRetryableHttpStatus = (statusCode?: number): boolean =>
  statusCode ? statusCode >= 500 : true;

const toError = (error: unknown): Error | undefined => {
  if (!error) return undefined;
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message));
  }
  return new Error('Unknown error occurred');
};

export const ErrorFactory = {
  domain: (message: string, cause?: unknown, statusCode?: number) =>
    Result.failure(new DomainError(message, toError(cause), statusCode)),
  useCase: (message: string, cause?: unknown, statusCode?: number) =>
    Result.failure(new UseCaseError(message, toError(cause), statusCode)),
  service: (message: string, cause?: unknown, statusCode?: number) =>
    Result.failure(new ServiceError(message, toError(cause), statusCode)),
  repository: (
    message: string,
    cause?: unknown,
    statusCode?: number,
    retryable?: boolean,
  ) =>
    Result.failure(
      new RepositoryError(
        message,
        toError(cause),
        statusCode,
        retryable ?? isRetryableHttpStatus(statusCode),
      ),
    ),
  infrastructure: (
    message: string,
    cause?: unknown,
    statusCode?: number,
    retryable?: boolean,
  ) =>
    Result.failure(
      new InfrastructureError(
        message,
        toError(cause),
        statusCode,
        retryable ?? isRetryableHttpStatus(statusCode),
      ),
    ),
};
