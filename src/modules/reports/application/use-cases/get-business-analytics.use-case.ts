import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { BusinessAnalyticsReport } from '../../domain/entities';
import {
  GetBusinessAnalyticsQuery,
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../../domain/ports';

@Injectable()
export class GetBusinessAnalyticsUseCase extends UseCase<
  GetBusinessAnalyticsQuery,
  BusinessAnalyticsReport,
  AppError
> {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
  ) {
    super();
  }

  async execute(
    input: GetBusinessAnalyticsQuery,
  ): Promise<Result<BusinessAnalyticsReport, AppError>> {
    try {
      if (input.dateUntil < input.dateFrom) {
        return ErrorFactory.useCase(
          'dateUntil must be greater than or equal to dateFrom',
          undefined,
          400,
        );
      }

      return Result.success(
        await this.reportsRepository.getBusinessAnalytics(input),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not build business analytics report',
        error,
      );
    }
  }
}
