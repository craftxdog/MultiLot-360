import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { AuditEvent } from '../../domain/entities';
import {
  AUDIT_EVENTS_REPOSITORY,
  AuditEventsRepository,
  ListAuditEventsQuery,
} from '../../domain/ports';

@Injectable()
export class ListAuditEventsUseCase extends UseCase<
  ListAuditEventsQuery,
  PaginatedResult<AuditEvent>,
  AppError
> {
  constructor(
    @Inject(AUDIT_EVENTS_REPOSITORY)
    private readonly auditEventsRepository: AuditEventsRepository,
  ) {
    super();
  }

  async execute(
    input: ListAuditEventsQuery,
  ): Promise<Result<PaginatedResult<AuditEvent>, AppError>> {
    try {
      return Result.success(await this.auditEventsRepository.list(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not list audit events',
        error,
      );
    }
  }
}
