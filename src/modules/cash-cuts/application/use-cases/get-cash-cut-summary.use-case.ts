import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { CashCutSummary } from '../../domain/entities';
import { CASH_CUTS_REPOSITORY, CashCutsRepository } from '../../domain/ports';

export type GetCashCutSummaryQuery = {
  cutId: string;
};

@Injectable()
export class GetCashCutSummaryUseCase extends UseCase<
  GetCashCutSummaryQuery,
  CashCutSummary,
  AppError
> {
  constructor(
    @Inject(CASH_CUTS_REPOSITORY)
    private readonly cashCutsRepository: CashCutsRepository,
  ) {
    super();
  }

  async execute(
    input: GetCashCutSummaryQuery,
  ): Promise<Result<CashCutSummary, AppError>> {
    try {
      const summary = await this.cashCutsRepository.getSummary(input.cutId);

      if (!summary) {
        return ErrorFactory.useCase('Cash cut not found', undefined, 404);
      }

      return Result.success(summary);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not get cash cut summary',
        error,
      );
    }
  }
}
