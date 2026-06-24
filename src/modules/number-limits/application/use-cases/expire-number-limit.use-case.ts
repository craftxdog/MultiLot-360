import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
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
