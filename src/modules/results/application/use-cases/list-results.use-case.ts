import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawResult } from '../../domain/entities';
import {
  ListResultsQuery,
  RESULTS_REPOSITORY,
  ResultsRepository,
} from '../../domain/ports';

@Injectable()
export class ListResultsUseCase extends UseCase<
  ListResultsQuery,
  PaginatedResult<DrawResult>,
  AppError
> {
  constructor(
    @Inject(RESULTS_REPOSITORY)
    private readonly resultsRepository: ResultsRepository,
  ) {
    super();
  }

  async execute(
    input: ListResultsQuery,
  ): Promise<Result<PaginatedResult<DrawResult>, AppError>> {
    try {
      return Result.success(await this.resultsRepository.list(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not list results',
        error,
      );
    }
  }
}
