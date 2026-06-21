import { AppError } from './exceptions/app.error';

export type Result<T, E extends AppError = AppError> = Success<T> | Failure<E>;

export class Success<T> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(readonly value: T) {}
}

export class Failure<E extends AppError = AppError> {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(readonly error: E) {}
}

export const Result = {
  success: <T>(value: T): Success<T> => new Success(value),
  failure: <E extends AppError>(error: E): Failure<E> => new Failure(error),
};

export function isSuccess<T, E extends AppError>(
  result: Result<T, E>,
): result is Success<T> {
  return result.isSuccess;
}

export function isFailure<T, E extends AppError>(
  result: Result<T, E>,
): result is Failure<E> {
  return result.isFailure;
}

export function isResult(value: unknown): value is Result<unknown, AppError> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'isSuccess' in value &&
    'isFailure' in value
  );
}
