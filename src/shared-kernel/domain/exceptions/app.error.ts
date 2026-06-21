export abstract class AppError extends Error {
  readonly timestamp: Date;
  readonly retryable: boolean;

  protected constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly cause?: Error,
    retryable = true,
  ) {
    super(message);
    this.name = new.target.name;
    this.timestamp = new Date();
    this.retryable = retryable;
    Error.captureStackTrace(this, this.constructor);
  }
}
