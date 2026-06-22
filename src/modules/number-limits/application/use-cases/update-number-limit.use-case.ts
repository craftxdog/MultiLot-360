import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { NumberLimit } from '../../domain/entities';
import {
  NUMBER_LIMITS_REPOSITORY,
  NumberLimitsRepository,
  UpdateNumberLimitInput,
} from '../../domain/ports';

export type UpdateNumberLimitCommand = UpdateNumberLimitInput;

@Injectable()
export class UpdateNumberLimitUseCase extends UseCase<
  UpdateNumberLimitCommand,
  NumberLimit,
  AppError
> {
  constructor(
    @Inject(NUMBER_LIMITS_REPOSITORY)
    private readonly numberLimitsRepository: NumberLimitsRepository,
  ) {
    super();
  }

  async execute(
    input: UpdateNumberLimitCommand,
  ): Promise<Result<NumberLimit, AppError>> {
    try {
      const dateError = this.validateDateRange(
        input.validFrom,
        input.validUntil,
      );

      if (dateError) {
        return ErrorFactory.useCase(dateError, undefined, 400);
      }

      const limit = await this.numberLimitsRepository.update(input);

      if (!limit) {
        return ErrorFactory.useCase('Number limit not found', undefined, 404);
      }

      return Result.success(limit);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not update number limit',
        error,
      );
    }
  }

  private validateDateRange(
    validFrom?: string,
    validUntil?: string | null,
  ): string | null {
    if (!validFrom || !validUntil) return null;

    return validUntil < validFrom
      ? 'validUntil must be greater than or equal to validFrom'
      : null;
  }
}
