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
import {
  SALES_REPOSITORY,
  SalesRepository,
  SalesVoidPolicy,
  UpdateSalesVoidPolicyInput,
} from '../../domain/ports';

export type UpdateSalesVoidPolicyCommand = UpdateSalesVoidPolicyInput;

@Injectable()
export class UpdateSalesVoidPolicyUseCase extends UseCase<
  UpdateSalesVoidPolicyCommand,
  SalesVoidPolicy,
  AppError
> {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: SalesRepository,
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
  ) {
    super();
  }

  async execute(
    input: UpdateSalesVoidPolicyCommand,
  ): Promise<Result<SalesVoidPolicy, AppError>> {
    try {
      if (input.windowMinutes < 1 || input.windowMinutes > 1440) {
        return ErrorFactory.useCase(
          'Void window must be between 1 and 1440 minutes',
          undefined,
          400,
        );
      }

      const policy = await this.salesRepository.updateVoidPolicy(input);

      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.salesVoidPolicyUpdated,
        aggregateId: 'sales.void_window_minutes',
        audience: operationalAudience.salesPolicy(),
        payload: {
          key: 'sales.void_window_minutes',
        },
      });

      return Result.success(policy);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not update sales void policy',
        error,
      );
    }
  }
}
