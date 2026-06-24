import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawResult } from '../../domain/entities';
import { RESULTS_REPOSITORY, ResultsRepository } from '../../domain/ports';

export type GetResultQuery = {
  resultId: string;
};

@Injectable()
export class GetResultUseCase extends UseCase<
  GetResultQuery,
  DrawResult,
  AppError
> {
  constructor(
    @Inject(RESULTS_REPOSITORY)
    private readonly resultsRepository: ResultsRepository,
  ) {
    super();
  }

  async execute(input: GetResultQuery): Promise<Result<DrawResult, AppError>> {
    try {
      const result = await this.resultsRepository.findById(input.resultId);

      if (!result) {
        return ErrorFactory.useCase('Result not found', undefined, 404);
      }

      return Result.success(result);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not get result',
        error,
      );
    }
  }
}
