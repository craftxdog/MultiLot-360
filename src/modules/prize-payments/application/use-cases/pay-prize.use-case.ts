import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  INTEGRATION_EVENT_PUBLISHER,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
  Result,
  UseCase,
  operationalAudience,
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
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
  ) {
    super();
  }

  async execute(
    input: PayPrizeCommand,
  ): Promise<Result<PrizePayment, AppError>> {
    try {
      const payment = await this.prizePaymentsRepository.pay(input);

      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.prizePaid,
        aggregateId: payment.saleId,
        audience: operationalAudience.prizePayments(payment.sale.seller.id),
        payload: {
          saleId: payment.saleId,
          resultId: payment.result.id,
          sellerId: payment.sale.seller.id,
        },
      });

      return Result.success(payment);
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
