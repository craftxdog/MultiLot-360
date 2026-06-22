import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { PrizePayment } from '../../domain/entities';
import {
  PRIZE_PAYMENTS_REPOSITORY,
  PrizePaymentsRepository,
} from '../../domain/ports';

export type GetPrizePaymentQuery = {
  saleId: string;
};

@Injectable()
export class GetPrizePaymentUseCase extends UseCase<
  GetPrizePaymentQuery,
  PrizePayment,
  AppError
> {
  constructor(
    @Inject(PRIZE_PAYMENTS_REPOSITORY)
    private readonly prizePaymentsRepository: PrizePaymentsRepository,
  ) {
    super();
  }

  async execute(
    input: GetPrizePaymentQuery,
  ): Promise<Result<PrizePayment, AppError>> {
    try {
      const payment = await this.prizePaymentsRepository.findBySaleId(
        input.saleId,
      );

      if (!payment) {
        return ErrorFactory.useCase('Prize payment not found', undefined, 404);
      }

      return Result.success(payment);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not get prize payment',
        error,
      );
    }
  }
}
