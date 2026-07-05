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
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
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

      const cashCut = await this.cashCutsRepository.create(input);

      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.cashCutCreated,
        aggregateId: cashCut.id,
        audience: operationalAudience.cashCuts(cashCut.visibleToSellers),
        payload: {
          cashCutId: cashCut.id,
          startDate: cashCut.startDate,
          endDate: cashCut.endDate,
          visibleToSellers: cashCut.visibleToSellers,
        },
      });

      return Result.success(cashCut);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not create cash cut',
        error,
      );
    }
  }
}
