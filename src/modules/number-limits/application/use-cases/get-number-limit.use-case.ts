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
} from '../../domain/ports';

export type GetNumberLimitQuery = {
  limitId: string;
};

@Injectable()
export class GetNumberLimitUseCase extends UseCase<
  GetNumberLimitQuery,
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
    input: GetNumberLimitQuery,
  ): Promise<Result<NumberLimit, AppError>> {
    try {
      const limit = await this.numberLimitsRepository.findById(input.limitId);

      if (!limit) {
        return ErrorFactory.useCase('Number limit not found', undefined, 404);
      }

      return Result.success(limit);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not get number limit',
        error,
      );
    }
  }
}
