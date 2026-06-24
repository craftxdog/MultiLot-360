import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { AuditEvent } from '../../domain/entities';
import {
  AUDIT_EVENTS_REPOSITORY,
  AuditEventsRepository,
} from '../../domain/ports';

export type GetAuditEventQuery = {
  eventId: string;
};

@Injectable()
export class GetAuditEventUseCase extends UseCase<
  GetAuditEventQuery,
  AuditEvent,
  AppError
> {
  constructor(
    @Inject(AUDIT_EVENTS_REPOSITORY)
    private readonly auditEventsRepository: AuditEventsRepository,
  ) {
    super();
  }

  async execute(
    input: GetAuditEventQuery,
  ): Promise<Result<AuditEvent, AppError>> {
    try {
      const event = await this.auditEventsRepository.findById(input.eventId);

      if (!event) {
        return ErrorFactory.useCase('Audit event not found', undefined, 404);
      }

      return Result.success(event);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not get audit event',
        error,
      );
    }
  }
}
