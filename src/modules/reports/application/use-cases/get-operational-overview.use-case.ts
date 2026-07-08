import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { OperationalOverviewReport } from '../../domain/entities';
import {
  GetOperationalOverviewQuery,
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../../domain/ports';

@Injectable()
export class GetOperationalOverviewUseCase extends UseCase<
  GetOperationalOverviewQuery,
  OperationalOverviewReport,
  AppError
> {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
  ) {
    super();
  }

  async execute(
    input: GetOperationalOverviewQuery,
  ): Promise<Result<OperationalOverviewReport, AppError>> {
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
        await this.reportsRepository.getOperationalOverview(scopedQuery.value),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not build operational overview report',
        error,
      );
    }
  }

  private toScopedQuery(
    input: GetOperationalOverviewQuery,
  ): Result<GetOperationalOverviewQuery, AppError> {
    const { actorRoleName, currentSellerId, ...query } = input;

    if (this.isAdmin(actorRoleName)) {
      return Result.success(query);
    }

    if (!currentSellerId) {
      return ErrorFactory.useCase(
        'Seller reports require an assigned seller profile',
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
