import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { CashCut } from '../../domain/entities';
import {
  CASH_CUTS_REPOSITORY,
  CashCutsRepository,
  CreateCashCutInput,
} from '../../domain/ports';

export type CreateCashCutCommand = CreateCashCutInput;

@Injectable()
export class CreateCashCutUseCase extends UseCase<
  CreateCashCutCommand,
  CashCut,
  AppError
> {
  constructor(
    @Inject(CASH_CUTS_REPOSITORY)
    private readonly cashCutsRepository: CashCutsRepository,
  ) {
    super();
  }

  async execute(
    input: CreateCashCutCommand,
  ): Promise<Result<CashCut, AppError>> {
    try {
      if (input.endDate < input.startDate) {
        return ErrorFactory.useCase(
          'endDate must be greater than or equal to startDate',
          undefined,
          400,
        );
      }

      return Result.success(await this.cashCutsRepository.create(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not create cash cut',
        error,
      );
    }
  }
}
