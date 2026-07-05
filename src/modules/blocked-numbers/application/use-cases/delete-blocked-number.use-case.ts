import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  INTEGRATION_EVENT_PUBLISHER,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
  Result,
  UseCase,
  operationalAudience,
} from '../../../../shared-kernel';
import { BlockedNumber } from '../../domain/entities';
import {
  BLOCKED_NUMBERS_REPOSITORY,
  BlockedNumbersRepository,
} from '../../domain/ports';

export type DeleteBlockedNumberCommand = {
  blockId: string;
};

@Injectable()
export class DeleteBlockedNumberUseCase extends UseCase<
  DeleteBlockedNumberCommand,
  BlockedNumber,
  AppError
> {
  constructor(
    @Inject(BLOCKED_NUMBERS_REPOSITORY)
    private readonly blockedNumbersRepository: BlockedNumbersRepository,
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
  ) {
    super();
  }

  async execute(
    input: DeleteBlockedNumberCommand,
  ): Promise<Result<BlockedNumber, AppError>> {
    try {
      const block = await this.blockedNumbersRepository.delete(input.blockId);

      if (!block) {
        return ErrorFactory.useCase('Blocked number not found', undefined, 404);
      }

      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.blockedNumberDeleted,
        aggregateId: block.id,
        audience: operationalAudience.blockedNumbers(),
        payload: {
          blockId: block.id,
          number: block.number,
          shiftId: block.shift?.id ?? null,
          date: block.date ?? block.shift?.date ?? null,
        },
      });

      return Result.success(block);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not delete blocked number',
        error,
      );
    }
  }
}
