import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { WinningSale } from '../../domain/entities';
import {
  ListWinningSalesQuery,
  RESULTS_REPOSITORY,
  ResultsRepository,
} from '../../domain/ports';

@Injectable()
export class ListWinningSalesUseCase extends UseCase<
  ListWinningSalesQuery,
  PaginatedResult<WinningSale>,
  AppError
> {
  constructor(
    @Inject(RESULTS_REPOSITORY)
    private readonly resultsRepository: ResultsRepository,
  ) {
    super();
  }

  async execute(
    input: ListWinningSalesQuery,
  ): Promise<Result<PaginatedResult<WinningSale>, AppError>> {
    try {
      const result = await this.resultsRepository.listWinningSales(input);

      if (!result) {
        return ErrorFactory.useCase('Result not found', undefined, 404);
      }

      return Result.success(result);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not list winning sales',
        error,
      );
    }
  }
}
