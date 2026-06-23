import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { SellerOperationalReport } from '../../domain/entities';
import {
  ListSellerOperationalReportsQuery,
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../../domain/ports';

@Injectable()
export class ListSellerOperationalReportsUseCase extends UseCase<
  ListSellerOperationalReportsQuery,
  PaginatedResult<SellerOperationalReport>,
  AppError
> {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
  ) {
    super();
  }

  async execute(
    input: ListSellerOperationalReportsQuery,
  ): Promise<Result<PaginatedResult<SellerOperationalReport>, AppError>> {
    try {
      if (input.dateUntil < input.dateFrom) {
        return ErrorFactory.useCase(
          'dateUntil must be greater than or equal to dateFrom',
          undefined,
          400,
        );
      }

      return Result.success(
        await this.reportsRepository.listSellerOperationalReports(input),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not list seller operational reports',
        error,
      );
    }
  }
}
