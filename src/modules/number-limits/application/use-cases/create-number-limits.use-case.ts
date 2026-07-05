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
  CreateNumberLimitsInput,
  NUMBER_LIMITS_REPOSITORY,
  NumberLimitsRepository,
} from '../../domain/ports';

export type CreateNumberLimitsCommand = CreateNumberLimitsInput;

@Injectable()
export class CreateNumberLimitsUseCase extends UseCase<
  CreateNumberLimitsCommand,
  NumberLimit[],
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
    input: CreateNumberLimitsCommand,
  ): Promise<Result<NumberLimit[], AppError>> {
    try {
      const numbers = this.normalizeUniqueNumbers(input.numbers);

      if (numbers.length === 0) {
        return ErrorFactory.useCase(
          'At least one number is required',
          undefined,
          400,
        );
      }

      const dateError = this.validateDateRange(
        input.validFrom,
        input.validUntil,
      );

      if (dateError) {
        return ErrorFactory.useCase(dateError, undefined, 400);
      }

      const limits = await this.numberLimitsRepository.createMany({
        ...input,
        numbers,
      });
      const firstLimit = limits[0];

      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.numberLimitsCreated,
        aggregateId: firstLimit?.id,
        audience: operationalAudience.numberLimits(firstLimit?.seller?.id),
        payload: {
          limitIds: limits.map((limit) => limit.id),
          sellerId: firstLimit?.seller?.id ?? null,
          drawConfigurationId: firstLimit?.drawConfiguration?.id ?? null,
          numbers: limits.map((limit) => limit.number),
        },
      });

      return Result.success(limits);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not create number limits',
        error,
      );
    }
  }

  private normalizeUniqueNumbers(numbers: string[]): string[] {
    return [...new Set(numbers.map((number) => number.padStart(2, '0')))];
  }

  private validateDateRange(
    validFrom: string,
    validUntil?: string,
  ): string | null {
    if (!validUntil) return null;

    return validUntil < validFrom
      ? 'validUntil must be greater than or equal to validFrom'
      : null;
  }
}
