import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { PrizePayment } from '../../domain/entities';
import {
  PayPrizeInput,
  PRIZE_PAYMENTS_REPOSITORY,
  PrizePaymentsRepository,
} from '../../domain/ports';

export type PayPrizeCommand = PayPrizeInput;

@Injectable()
export class PayPrizeUseCase extends UseCase<
  PayPrizeCommand,
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
    input: PayPrizeCommand,
  ): Promise<Result<PrizePayment, AppError>> {
    try {
      return Result.success(await this.prizePaymentsRepository.pay(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not pay prize',
        error,
        this.toHttpStatus(error),
      );
    }
  }

  private toHttpStatus(error: unknown): number | undefined {
    if (!(error instanceof Error)) return undefined;
    const message = error.message.toLowerCase();

    if (message.includes('not found')) return 404;
    if (message.includes('already')) return 409;
    if (
      message.includes('not a winner') ||
      message.includes('active') ||
      message.includes('match')
    ) {
      return 422;
    }

    return undefined;
  }
}
