import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { Sale } from '../../domain/entities';
import {
  ListSalesQuery,
  SALES_REPOSITORY,
  SalesRepository,
} from '../../domain/ports';

export type ListSalesUseCaseQuery = ListSalesQuery & {
  currentSellerId?: string;
  actorRoleName?: string;
};

@Injectable()
export class ListSalesUseCase extends UseCase<
  ListSalesUseCaseQuery,
  PaginatedResult<Sale>,
  AppError
> {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: SalesRepository,
  ) {
    super();
  }

  async execute(
    input: ListSalesUseCaseQuery,
  ): Promise<Result<PaginatedResult<Sale>, AppError>> {
    try {
      const query = this.applySellerScope(input);

      if (query.isFailure) {
        return query;
      }

      return Result.success(await this.salesRepository.list(query.value));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not list sales',
        error,
      );
    }
  }

  private applySellerScope(
    input: ListSalesUseCaseQuery,
  ): Result<ListSalesQuery, AppError> {
    const { actorRoleName, currentSellerId, ...query } = input;

    if (this.isAdmin(actorRoleName)) {
      return Result.success(query);
    }

    if (!currentSellerId) {
      return ErrorFactory.useCase('sellerId is required', undefined, 400);
    }

    if (query.sellerId && query.sellerId !== currentSellerId) {
      return ErrorFactory.useCase(
        'Sellers can only list their own sales',
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
