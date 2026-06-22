import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { PrizePayment } from '../../domain/entities';
import {
  ListPrizePaymentsQuery,
  PRIZE_PAYMENTS_REPOSITORY,
  PrizePaymentsRepository,
} from '../../domain/ports';

@Injectable()
export class ListPrizePaymentsUseCase extends UseCase<
  ListPrizePaymentsQuery,
  PaginatedResult<PrizePayment>,
  AppError
> {
  constructor(
    @Inject(PRIZE_PAYMENTS_REPOSITORY)
    private readonly prizePaymentsRepository: PrizePaymentsRepository,
  ) {
    super();
  }

  async execute(
    input: ListPrizePaymentsQuery,
  ): Promise<Result<PaginatedResult<PrizePayment>, AppError>> {
    try {
      return Result.success(await this.prizePaymentsRepository.list(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not list prize payments',
        error,
      );
    }
  }
}
