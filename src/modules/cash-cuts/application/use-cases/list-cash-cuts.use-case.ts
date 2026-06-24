import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { CashCut } from '../../domain/entities';
import {
  CASH_CUTS_REPOSITORY,
  CashCutsRepository,
  ListCashCutsQuery,
} from '../../domain/ports';

@Injectable()
export class ListCashCutsUseCase extends UseCase<
  ListCashCutsQuery,
  PaginatedResult<CashCut>,
  AppError
> {
  constructor(
    @Inject(CASH_CUTS_REPOSITORY)
    private readonly cashCutsRepository: CashCutsRepository,
  ) {
    super();
  }

  async execute(
    input: ListCashCutsQuery,
  ): Promise<Result<PaginatedResult<CashCut>, AppError>> {
    try {
      return Result.success(await this.cashCutsRepository.list(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not list cash cuts',
        error,
      );
    }
  }
}
