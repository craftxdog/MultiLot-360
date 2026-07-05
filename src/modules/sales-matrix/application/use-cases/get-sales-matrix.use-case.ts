import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { SalesMatrix, SalesMatrixFilters } from '../../domain/entities';
import {
  SALES_MATRIX_REPOSITORY,
  SalesMatrixRepository,
} from '../../domain/ports';

export type GetSalesMatrixQuery = SalesMatrixFilters;

@Injectable()
export class GetSalesMatrixUseCase extends UseCase<
  GetSalesMatrixQuery,
  SalesMatrix,
  AppError
> {
  constructor(
    @Inject(SALES_MATRIX_REPOSITORY)
    private readonly repository: SalesMatrixRepository,
  ) {
    super();
  }

  async execute(
    input: GetSalesMatrixQuery,
  ): Promise<Result<SalesMatrix, AppError>> {
    try {
      return Result.success(await this.repository.get(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not build the sales matrix',
        error,
      );
    }
  }
}
