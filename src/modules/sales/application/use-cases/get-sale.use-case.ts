import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { Sale } from '../../domain/entities';
import { SALES_REPOSITORY, SalesRepository } from '../../domain/ports';

export type GetSaleQuery = {
  saleId: string;
  currentSellerId?: string;
  actorRoleName?: string;
};

@Injectable()
export class GetSaleUseCase extends UseCase<GetSaleQuery, Sale, AppError> {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: SalesRepository,
  ) {
    super();
  }

  async execute(input: GetSaleQuery): Promise<Result<Sale, AppError>> {
    try {
      const sale = await this.salesRepository.findById(input.saleId);

      if (!sale) {
        return ErrorFactory.useCase('Sale not found', undefined, 404);
      }

      if (!this.canAccessSale(sale, input)) {
        return ErrorFactory.useCase(
          'Sellers can only access their own sales',
          undefined,
          403,
        );
      }

      return Result.success(sale);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not get sale',
        error,
      );
    }
  }

  private canAccessSale(sale: Sale, input: GetSaleQuery): boolean {
    return (
      this.isAdmin(input.actorRoleName) ||
      Boolean(input.currentSellerId && sale.seller.id === input.currentSellerId)
    );
  }

  private isAdmin(roleName?: string): boolean {
    return roleName?.toUpperCase() === 'ADMIN';
  }
}
