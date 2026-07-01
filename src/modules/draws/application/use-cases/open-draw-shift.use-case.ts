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
import {
  DRAWS_REPOSITORY,
  DrawsRepository,
  OpenDrawShiftInput,
} from '../../domain/ports';

export type OpenDrawShiftCommand = OpenDrawShiftInput;

@Injectable()
export class OpenDrawShiftUseCase extends UseCase<
  OpenDrawShiftCommand,
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
    input: OpenDrawShiftCommand,
  ): Promise<Result<DrawShift, AppError>> {
    try {
      const shift = await this.drawsRepository.openShift(input);

      publishDrawShiftEvent(
        this.eventPublisher,
        OPERATIONAL_EVENTS.drawShiftOpened,
        shift,
      );

      return Result.success(shift);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not open draw shift',
        error,
      );
    }
  }
}
