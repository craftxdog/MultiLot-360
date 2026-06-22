import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { NumberLimit } from '../../domain/entities';
import {
  ListNumberLimitsQuery,
  NUMBER_LIMITS_REPOSITORY,
  NumberLimitsRepository,
} from '../../domain/ports';

@Injectable()
export class ListNumberLimitsUseCase extends UseCase<
  ListNumberLimitsQuery,
  PaginatedResult<NumberLimit>,
  AppError
> {
  constructor(
    @Inject(NUMBER_LIMITS_REPOSITORY)
    private readonly numberLimitsRepository: NumberLimitsRepository,
  ) {
    super();
  }

  async execute(
    input: ListNumberLimitsQuery,
  ): Promise<Result<PaginatedResult<NumberLimit>, AppError>> {
    try {
      return Result.success(await this.numberLimitsRepository.list(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not list number limits',
        error,
      );
    }
  }
}
