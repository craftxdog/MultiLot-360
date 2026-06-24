import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { CashCut } from '../../domain/entities';
import { CASH_CUTS_REPOSITORY, CashCutsRepository } from '../../domain/ports';

export type GetCashCutQuery = {
  cutId: string;
};

@Injectable()
export class GetCashCutUseCase extends UseCase<
  GetCashCutQuery,
  CashCut,
  AppError
> {
  constructor(
    @Inject(CASH_CUTS_REPOSITORY)
    private readonly cashCutsRepository: CashCutsRepository,
  ) {
    super();
  }

  async execute(input: GetCashCutQuery): Promise<Result<CashCut, AppError>> {
    try {
      const cut = await this.cashCutsRepository.findById(input.cutId);

      if (!cut) {
        return ErrorFactory.useCase('Cash cut not found', undefined, 404);
      }

      return Result.success(cut);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not get cash cut',
        error,
      );
    }
  }
}
