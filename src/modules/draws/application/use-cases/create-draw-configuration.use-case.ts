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
import { publishDrawConfigurationEvent } from '../events';
import { DrawConfiguration } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

export type CreateDrawConfigurationCommand = {
  code: string;
  time: string;
  tuesdayOnly?: boolean;
  lockSecondsBefore?: number;
  reopenSecondsAfter?: number;
  active?: boolean;
};

@Injectable()
export class CreateDrawConfigurationUseCase extends UseCase<
  CreateDrawConfigurationCommand,
  DrawConfiguration,
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
    input: CreateDrawConfigurationCommand,
  ): Promise<Result<DrawConfiguration, AppError>> {
    try {
      const configuration = await this.drawsRepository.createConfiguration({
        ...input,
        code: input.code.trim().toLowerCase(),
      });

      publishDrawConfigurationEvent(
        this.eventPublisher,
        OPERATIONAL_EVENTS.drawConfigurationCreated,
        configuration,
      );

      return Result.success(configuration);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not create draw configuration',
        error,
      );
    }
  }
}
