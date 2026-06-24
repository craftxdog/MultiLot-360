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
  RecordAuditEventInput,
} from '../../domain/ports';

export type RecordAuditEventCommand = RecordAuditEventInput;

@Injectable()
export class RecordAuditEventUseCase extends UseCase<
  RecordAuditEventCommand,
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
    input: RecordAuditEventCommand,
  ): Promise<Result<AuditEvent, AppError>> {
    try {
      if (!input.event.trim()) {
        return ErrorFactory.useCase(
          'Audit event name is required',
          undefined,
          400,
        );
      }

      return Result.success(
        await this.auditEventsRepository.record({
          ...input,
          event: input.event.trim(),
        }),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not record audit event',
        error,
      );
    }
  }
}
