import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  INTEGRATION_EVENT_PUBLISHER,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { publishDrawShiftEvent } from '../events';
import { DrawShift } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

export type CloseDrawShiftCommand = {
  shiftId: string;
};

@Injectable()
export class CloseDrawShiftUseCase extends UseCase<
  CloseDrawShiftCommand,
  DrawShift,
  AppError
> {
  constructor(
    @Inject(DRAWS_REPOSITORY)
    private readonly drawsRepository: DrawsRepository,
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
  ) {
    super();
  }

  async execute(
    input: CloseDrawShiftCommand,
  ): Promise<Result<DrawShift, AppError>> {
    try {
      const shift = await this.drawsRepository.closeShift(input.shiftId);

      if (!shift) {
        return ErrorFactory.useCase(
          'Draw shift does not exist',
          undefined,
          404,
        );
      }

      publishDrawShiftEvent(
        this.eventPublisher,
        OPERATIONAL_EVENTS.drawShiftClosed,
        shift,
      );

      return Result.success(shift);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not close draw shift',
        error,
      );
    }
  }
}
