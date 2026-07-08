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

      const scopedQuery = this.toScopedQuery(input);

      if (scopedQuery.isFailure) {
        return scopedQuery;
      }

      return Result.success(
        await this.reportsRepository.getBusinessAnalytics(scopedQuery.value),
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

  private toScopedQuery(
    input: GetBusinessAnalyticsQuery,
  ): Result<GetBusinessAnalyticsQuery, AppError> {
    const { actorRoleName, currentSellerId, ...query } = input;

    if (this.isAdmin(actorRoleName)) {
      return Result.success(query);
    }

    if (!currentSellerId) {
      return ErrorFactory.useCase(
        'Seller analytics require an assigned seller profile',
        undefined,
        403,
      );
    }

    return Result.success({
      ...query,
      sellerId: currentSellerId,
    });
  }

  private isAdmin(roleName?: string): boolean {
    return roleName?.toUpperCase() === 'ADMIN';
  }
}
