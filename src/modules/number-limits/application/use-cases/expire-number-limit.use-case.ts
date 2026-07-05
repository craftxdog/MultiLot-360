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
import { NumberLimit } from '../../domain/entities';
import {
  ExpireNumberLimitInput,
  NUMBER_LIMITS_REPOSITORY,
  NumberLimitsRepository,
} from '../../domain/ports';

export type ExpireNumberLimitCommand = ExpireNumberLimitInput;

@Injectable()
export class ExpireNumberLimitUseCase extends UseCase<
  ExpireNumberLimitCommand,
  NumberLimit,
  AppError
> {
  constructor(
    @Inject(NUMBER_LIMITS_REPOSITORY)
    private readonly numberLimitsRepository: NumberLimitsRepository,
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
  ) {
    super();
  }

  async execute(
    input: ExpireNumberLimitCommand,
  ): Promise<Result<NumberLimit, AppError>> {
    try {
      const limit = await this.numberLimitsRepository.expire(input);

      if (!limit) {
        return ErrorFactory.useCase('Number limit not found', undefined, 404);
      }

      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.numberLimitExpired,
        aggregateId: limit.id,
        audience: operationalAudience.numberLimits(limit.seller?.id),
        payload: {
          limitId: limit.id,
          sellerId: limit.seller?.id ?? null,
          drawConfigurationId: limit.drawConfiguration?.id ?? null,
          number: limit.number,
        },
      });

      return Result.success(limit);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not expire number limit',
        error,
      );
    }
  }
}
